import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { XMLParser } from "fast-xml-parser";
import {
  PLEX_BASE_URL_SETTING,
  PLEX_SERVER_IDENTIFIER_SETTING,
  PLEX_SERVER_NAME_SETTING,
  SettingsService,
} from "../settings/settings.service";
import { runWithConcurrency } from "../utils/async-pool";

const PLEX_PRODUCT = "FamilySync";
const PLEX_CLIENT_IDENTIFIER = "familysync";

type PlexPinResponse = {
  id: number;
  code: string;
  authToken?: string;
};

type PlexAccount = {
  id: number;
  username?: string;
  title?: string;
  thumb?: string;
};

type PlexResource = {
  name: string;
  product: string;
  provides: string;
  clientIdentifier: string;
  accessToken?: string;
  owned?: boolean;
  ownerId?: number;
  connections?: Array<{
    uri: string;
    local?: boolean;
  }>;
};

export type PlexHomeUser = {
  id: string;
  title: string;
  thumb?: string;
  restricted: boolean;
  protected: boolean;
  linked: boolean;
};

export type ResolvedPlexUser = {
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
  accountToken: string;
  serverAccessToken: string;
  isAdmin: boolean;
  serverClientIdentifier: string;
  serverName: string;
};

export type PlexMediaType = "movie" | "show" | "season" | "episode";

export type PlexMediaMetadata = {
  ratingKey: string;
  mediaType: PlexMediaType;
  title?: string;
  summary?: string;
  thumb?: string;
  parentTitle?: string;
  grandparentTitle?: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  mediaIndex?: number;
  parentIndex?: number;
  userRating?: number;
  guid?: string;
  tmdbId?: number;
  tvdbId?: number;
  year?: number;
};

type PlexPosterMetadata = {
  type?: string;
  thumb?: string;
  parentThumb?: string;
  grandparentThumb?: string;
};

export function selectPlexPosterPath(
  item: PlexPosterMetadata,
): string | undefined {
  if (item.type === "episode") {
    return item.parentThumb ?? item.grandparentThumb ?? item.thumb;
  }

  return item.thumb ?? item.grandparentThumb ?? item.parentThumb;
}

export type PlexLibrary = {
  key: string;
  title: string;
  type: "movie" | "show";
  count?: number;
};

export function parsePlexLibraryCount(container: {
  totalSize?: number | string;
  size?: number | string;
  Metadata?: unknown[];
}): number | undefined {
  const value =
    container.totalSize ?? container.size ?? container.Metadata?.length;
  if (value === undefined || value === "") {
    return undefined;
  }

  const count = Number(value);
  return Number.isFinite(count) ? count : undefined;
}

export type SelectedPlexServer = {
  accessToken: string;
  clientIdentifier: string;
  name: string;
};

@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);

  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async createPin(): Promise<{ pinId: number; code: string; authUrl: string }> {
    const pin = await this.plexFetch<PlexPinResponse>(
      "https://plex.tv/api/v2/pins?strong=true",
      {
        method: "POST",
      },
    );

    const clientIdentifier = this.clientIdentifier;
    const params = new URLSearchParams({
      clientID: clientIdentifier,
      code: pin.code,
      "context[device][product]": this.product,
      "context[device][version]": "Plex OAuth",
      "context[device][platform]": "Web",
      "context[device][platformVersion]": "1.0",
      "context[device][device]": "Browser",
      "context[device][deviceName]": this.product,
      "context[device][model]": "Plex OAuth",
      "context[device][layout]": "desktop",
    });

    return {
      pinId: pin.id,
      code: pin.code,
      authUrl: `https://app.plex.tv/auth/#!?${params.toString()}`,
    };
  }

  async pollPin(pinId: number): Promise<ResolvedPlexUser | undefined> {
    const pin = await this.plexFetch<PlexPinResponse>(
      `https://plex.tv/api/v2/pins/${pinId}`,
    );

    if (!pin.authToken) {
      return undefined;
    }

    this.logger.log(
      `Plex PIN ${pinId} authorized; resolving Plex user and server token.`,
    );
    return this.resolveUser(pin.authToken);
  }

  async resolveUser(accountToken: string): Promise<ResolvedPlexUser> {
    let account: { user: PlexAccount };
    let resources: { MediaContainer: { Device?: PlexResource[] } };

    try {
      account = await this.plexFetch<{ user: PlexAccount }>(
        "https://plex.tv/users/account.json",
        {
          token: accountToken,
        },
      );
      this.logger.log(
        `Resolved Plex account ${account.user.username ?? account.user.title ?? account.user.id}.`,
      );
    } catch (error) {
      this.logger.error(
        "Failed to resolve Plex account from auth token.",
        error,
      );
      throw new BadRequestException(
        `Unable to resolve Plex account: ${this.errorMessage(error)}`,
      );
    }

    try {
      resources = await this.plexResources(accountToken);
    } catch (error) {
      this.logger.error(
        "Failed to fetch Plex resources for linked account.",
        error,
      );
      throw new BadRequestException(
        `Unable to fetch Plex resources: ${this.errorMessage(error)}`,
      );
    }

    const devices = resources.MediaContainer.Device ?? [];
    this.logger.log(
      `Plex resources returned ${devices.length} device(s): ${devices
        .map(
          (device) =>
            `${device.name}/${device.clientIdentifier}/${device.product}`,
        )
        .join(", ")}`,
    );
    const plexUserId = String(account.user.id);
    const candidateAdminServer = await this.selectAdminCandidateServer(devices);
    const isAdmin =
      candidateAdminServer !== undefined &&
      (Boolean(candidateAdminServer.owned) ||
        String(candidateAdminServer.ownerId ?? "") === plexUserId);
    const server = isAdmin
      ? await this.selectAndPersistAdminServer(devices)
      : await this.selectConfiguredServer(devices);

    if (!server.accessToken) {
      throw new BadRequestException(
        `Selected Plex server "${server.name}" did not provide a server access token.`,
      );
    }

    return {
      plexUserId,
      plexUsername: account.user.username ?? account.user.title ?? plexUserId,
      plexThumb: account.user.thumb,
      accountToken,
      serverAccessToken: server.accessToken,
      isAdmin,
      serverClientIdentifier: server.clientIdentifier,
      serverName: server.name,
    };
  }

  async resolveConfiguredServerToken(
    accountToken: string,
  ): Promise<SelectedPlexServer> {
    const resources = await this.plexResources(accountToken);
    const server = await this.selectConfiguredServer(
      resources.MediaContainer.Device ?? [],
    );

    if (!server.accessToken) {
      throw new BadRequestException(
        `Selected Plex server "${server.name}" did not provide a server access token.`,
      );
    }

    return {
      accessToken: server.accessToken,
      clientIdentifier: server.clientIdentifier,
      name: server.name,
    };
  }

  async bootstrapServerSelectionFromAdminToken(
    accountToken: string,
  ): Promise<SelectedPlexServer> {
    const resources = await this.plexResources(accountToken);
    const server = await this.selectAndPersistAdminServer(
      resources.MediaContainer.Device ?? [],
    );

    if (!server.accessToken) {
      throw new BadRequestException(
        `Selected Plex server "${server.name}" did not provide a server access token.`,
      );
    }

    return {
      accessToken: server.accessToken,
      clientIdentifier: server.clientIdentifier,
      name: server.name,
    };
  }

  async listManagedHomeUsers(
    adminAccountToken: string,
    linkedPlexUserIds: Set<string>,
  ): Promise<PlexHomeUser[]> {
    const response = await fetch("https://plex.tv/api/home/users", {
      headers: {
        Accept: "application/xml, application/json",
        "X-Plex-Product": this.product,
        "X-Plex-Version": "0.1.0",
        "X-Plex-Client-Identifier": this.clientIdentifier,
        "X-Plex-Token": adminAccountToken,
      },
    });
    const body = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Plex Home users request failed: HTTP ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    const parsed = this.parsePlexBody(body);
    const users = this.toArray<Record<string, unknown>>(
      parsed.MediaContainer?.User ?? parsed.home?.User ?? parsed.Home?.User,
    );

    return users
      .map((user) => ({
        id: String(user.id ?? ""),
        title: String(user.title ?? user.username ?? user.id ?? ""),
        thumb:
          user.thumb === undefined || user.thumb === ""
            ? undefined
            : String(user.thumb),
        restricted: Boolean(this.parsePlexBoolean(user.restricted)),
        protected: Boolean(this.parsePlexBoolean(user.protected)),
        linked: linkedPlexUserIds.has(String(user.id ?? "")),
      }))
      .filter((user) => user.id && user.restricted);
  }

  async resolveManagedHomeUser(
    admin: {
      plexUserId: string;
      plexAccountToken?: string;
    },
    managedUserId: string,
    pin?: string,
  ): Promise<ResolvedPlexUser> {
    if (!admin.plexAccountToken) {
      throw new BadRequestException(
        "The linked admin user does not have an account token. Re-link the admin account before importing managed users.",
      );
    }

    const switchUrl = new URL(
      `https://plex.tv/api/home/users/${managedUserId}/switch`,
    );

    if (pin) {
      switchUrl.searchParams.set("pin", pin);
    }

    const response = await fetch(switchUrl, {
      method: "POST",
      headers: {
        Accept: "application/xml, application/json",
        "X-Plex-Product": this.product,
        "X-Plex-Version": "0.1.0",
        "X-Plex-Client-Identifier": this.clientIdentifier,
        "X-Plex-Token": admin.plexAccountToken,
      },
    });
    const body = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Plex Home user switch failed: HTTP ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    const parsed = this.parsePlexBody(body);
    const managedAccountToken =
      parsed.user?.authenticationToken ??
      parsed.User?.authenticationToken ??
      parsed.MediaContainer?.User?.authenticationToken;

    if (!managedAccountToken) {
      throw new BadRequestException(
        `Plex Home user switch did not return an authentication token.`,
      );
    }

    const homeUser = (
      await this.listManagedHomeUsers(admin.plexAccountToken, new Set())
    ).find((user) => user.id === managedUserId);
    const server = await this.resolveConfiguredServerToken(
      String(managedAccountToken),
    );

    return {
      plexUserId: managedUserId,
      plexUsername: homeUser?.title ?? managedUserId,
      plexThumb: homeUser?.thumb,
      accountToken: String(managedAccountToken),
      serverAccessToken: server.accessToken,
      isAdmin: false,
      serverClientIdentifier: server.clientIdentifier,
      serverName: server.name,
    };
  }

  async getMediaMetadata(
    ratingKey: string,
    serverAccessToken: string,
  ): Promise<PlexMediaMetadata> {
    const metadata = await this.pmsFetch<any>(
      `/library/metadata/${ratingKey}`,
      serverAccessToken,
      {
        includeUserState: "1",
      },
    );
    const item = metadata.MediaContainer?.Metadata?.[0];

    if (!item) {
      throw new BadRequestException(
        `Plex returned no metadata for ratingKey ${ratingKey}.`,
      );
    }

    return {
      ratingKey: String(item.ratingKey ?? ratingKey),
      mediaType: this.normalizeMediaType(item.type),
      title: item.title,
      summary: item.summary,
      thumb: selectPlexPosterPath(item),
      parentTitle: item.parentTitle,
      grandparentTitle: item.grandparentTitle,
      parentRatingKey:
        item.parentRatingKey === undefined
          ? undefined
          : String(item.parentRatingKey),
      grandparentRatingKey:
        item.grandparentRatingKey === undefined
          ? undefined
          : String(item.grandparentRatingKey),
      mediaIndex:
        item.index === undefined || item.index === ""
          ? undefined
          : Number(item.index),
      parentIndex:
        item.parentIndex === undefined || item.parentIndex === ""
          ? undefined
          : Number(item.parentIndex),
      userRating: this.parseRating(item.userRating),
      guid: item.guid,
      tmdbId: this.extractGuidId(item, "tmdb"),
      tvdbId: this.extractGuidId(item, "tvdb"),
      year: item.year === undefined ? undefined : Number(item.year),
    };
  }

  async getMovieMetadata(
    ratingKey: string,
    serverAccessToken: string,
  ): Promise<PlexMediaMetadata> {
    return this.getMediaMetadata(ratingKey, serverAccessToken);
  }

  async listLibraries(serverAccessToken: string): Promise<PlexLibrary[]> {
    const sections = await this.pmsFetch<any>(
      "/library/sections",
      serverAccessToken,
    );
    const mediaSections = (sections.MediaContainer?.Directory ?? []).filter(
      (section: any) => section.type === "movie" || section.type === "show",
    );

    const libraries: PlexLibrary[] = mediaSections.map((section: any) => ({
      key: String(section.key),
      title: String(section.title ?? section.key),
      type: section.type,
      count: section.count === undefined ? undefined : Number(section.count),
    }));

    await runWithConcurrency(libraries, 4, async (library) => {
      if (library.count !== undefined) {
        return;
      }

      try {
        const response = await this.pmsFetch<{
          MediaContainer?: {
            totalSize?: number | string;
            size?: number | string;
            Metadata?: unknown[];
          };
        }>(`/library/sections/${library.key}/all`, serverAccessToken, {
          type: library.type === "movie" ? "1" : "2",
          "X-Plex-Container-Start": "0",
          "X-Plex-Container-Size": "0",
        });
        library.count = parsePlexLibraryCount(response.MediaContainer ?? {});
      } catch (error) {
        this.logger.warn(
          `Unable to load item count for Plex library ${library.key}: ${this.errorMessage(error)}`,
        );
      }
    });

    return libraries;
  }

  async listMovieLibraries(serverAccessToken: string): Promise<PlexLibrary[]> {
    return (await this.listLibraries(serverAccessToken)).filter(
      (library) => library.type === "movie",
    );
  }

  async listMediaRatingKeys(
    serverAccessToken: string,
    options: {
      includeMovies?: boolean;
      includeTv?: boolean;
      movieLibraryKeys?: string[];
      tvLibraryKeys?: string[];
    } = {},
  ): Promise<string[]> {
    const libraries = await this.listLibraries(serverAccessToken);
    const includeMovies = options.includeMovies ?? true;
    const includeTv = options.includeTv ?? true;
    const selectedMovieKeys = new Set(
      (options.movieLibraryKeys ?? []).filter(Boolean),
    );
    const selectedTvKeys = new Set(
      (options.tvLibraryKeys ?? []).filter(Boolean),
    );
    const sections = libraries.filter((section) => {
      if (section.type === "movie") {
        if (!includeMovies) {
          return false;
        }
        return (
          selectedMovieKeys.size === 0 || selectedMovieKeys.has(section.key)
        );
      }

      if (!includeTv) {
        return false;
      }
      return selectedTvKeys.size === 0 || selectedTvKeys.has(section.key);
    });
    const ratingKeys = new Set<string>();

    for (const section of sections) {
      const items = await this.pmsFetch<any>(
        `/library/sections/${section.key}/all`,
        serverAccessToken,
        { type: section.type === "movie" ? "1" : "2" },
      );

      const sectionItems = (items.MediaContainer?.Metadata ?? []) as Array<{
        ratingKey?: string | number;
      }>;

      for (const item of sectionItems) {
        if (item.ratingKey) {
          ratingKeys.add(String(item.ratingKey));
        }
      }

      if (section.type === "show") {
        await runWithConcurrency(sectionItems, 4, async (item) => {
          if (!item.ratingKey) {
            return;
          }

          for (const childKey of await this.listShowChildRatingKeys(
            String(item.ratingKey),
            serverAccessToken,
          )) {
            ratingKeys.add(childKey);
          }
        });
      }
    }

    return [...ratingKeys];
  }

  async listMovieRatingKeys(
    serverAccessToken: string,
    libraryKeys?: string[],
  ): Promise<string[]> {
    return this.listMediaRatingKeys(serverAccessToken, {
      includeMovies: true,
      includeTv: false,
      movieLibraryKeys: libraryKeys,
    });
  }

  private async listShowChildRatingKeys(
    showRatingKey: string,
    serverAccessToken: string,
  ): Promise<string[]> {
    const ratingKeys = new Set<string>();
    const children = await this.pmsFetch<any>(
      `/library/metadata/${showRatingKey}/children`,
      serverAccessToken,
    );

    for (const season of children.MediaContainer?.Metadata ?? []) {
      if (season.ratingKey) {
        ratingKeys.add(String(season.ratingKey));
      }

      const leaves = await this.pmsFetch<any>(
        `/library/metadata/${season.ratingKey}/children`,
        serverAccessToken,
      );

      for (const episode of leaves.MediaContainer?.Metadata ?? []) {
        if (episode.ratingKey) {
          ratingKeys.add(String(episode.ratingKey));
        }
      }
    }

    return [...ratingKeys];
  }

  private async selectConfiguredServer(
    resources: PlexResource[],
  ): Promise<PlexResource> {
    const serverClientIdentifier = await this.settings.get(
      PLEX_SERVER_IDENTIFIER_SETTING,
    );
    const serverName = await this.settings.get(PLEX_SERVER_NAME_SETTING);
    const servers = resources.filter(
      (resource) =>
        resource.product === "Plex Media Server" &&
        resource.provides.includes("server"),
    );

    const server = serverClientIdentifier
      ? servers.find(
          (resource) => resource.clientIdentifier === serverClientIdentifier,
        )
      : serverName
        ? servers.find((resource) => resource.name === serverName)
        : undefined;

    if (!server) {
      const configured = [serverClientIdentifier, serverName]
        .filter(Boolean)
        .join(" / ");
      throw new BadRequestException(
        configured
          ? `This Plex account does not have access to the configured Plex server (${configured}).`
          : "The Plex server has not been selected yet. Complete the setup wizard with the Plex server owner account first.",
      );
    }

    this.logger.log(
      `Selected Plex server "${server.name}" (${server.clientIdentifier}).`,
    );
    return server;
  }

  private async selectAndPersistAdminServer(
    resources: PlexResource[],
  ): Promise<PlexResource> {
    const configuredIdentifier = await this.settings.get(
      PLEX_SERVER_IDENTIFIER_SETTING,
    );
    const configuredName = await this.settings.get(PLEX_SERVER_NAME_SETTING);
    const servers = resources.filter(
      (resource) =>
        resource.product === "Plex Media Server" &&
        resource.provides.includes("server"),
    );
    const ownedServers = servers.filter((server) => server.owned);
    const server =
      servers.find(
        (resource) => resource.clientIdentifier === configuredIdentifier,
      ) ??
      servers.find((resource) => resource.name === configuredName) ??
      (ownedServers.length === 1 ? ownedServers[0] : undefined);

    if (!server) {
      throw new BadRequestException(
        ownedServers.length > 1
          ? "This Plex account owns multiple Plex servers. Support for choosing among them is not available yet."
          : "No owned Plex Media Server was returned for the admin account.",
      );
    }

    await this.settings.set(
      PLEX_SERVER_IDENTIFIER_SETTING,
      server.clientIdentifier,
    );
    await this.settings.set(PLEX_SERVER_NAME_SETTING, server.name);
    this.logger.log(
      `Selected Plex server "${server.name}" (${server.clientIdentifier}) for FamilySync.`,
    );
    return server;
  }

  private async selectAdminCandidateServer(
    resources: PlexResource[],
  ): Promise<PlexResource | undefined> {
    const configuredIdentifier = await this.settings.get(
      PLEX_SERVER_IDENTIFIER_SETTING,
    );
    const configuredName = await this.settings.get(PLEX_SERVER_NAME_SETTING);
    const servers = resources.filter(
      (resource) =>
        resource.product === "Plex Media Server" &&
        resource.provides.includes("server"),
    );

    return (
      servers.find(
        (resource) => resource.clientIdentifier === configuredIdentifier,
      ) ??
      servers.find((resource) => resource.name === configuredName) ??
      servers.find((resource) => resource.owned)
    );
  }

  async listServerConnections(accountToken: string): Promise<{
    serverName?: string;
    clientIdentifier?: string;
    currentBaseUrl?: string;
    candidates: Array<{ uri: string; local: boolean }>;
  }> {
    const resources = await this.plexResources(accountToken);
    const server = await this.selectAdminCandidateServer(
      resources.MediaContainer.Device ?? [],
    );
    const currentBaseUrl = await this.settings.get(PLEX_BASE_URL_SETTING);

    if (!server) {
      return { currentBaseUrl, candidates: [] };
    }

    const seen = new Set<string>();
    const candidates = (server.connections ?? [])
      .map((connection) => ({
        uri: connection.uri.replace(/\/+$/, ""),
        local: Boolean(connection.local),
      }))
      .filter((connection) => {
        if (!connection.uri || seen.has(connection.uri)) {
          return false;
        }
        seen.add(connection.uri);
        return true;
      });

    return {
      serverName: server.name,
      clientIdentifier: server.clientIdentifier,
      currentBaseUrl,
      candidates,
    };
  }

  async testServerBaseUrl(
    uri: string,
    serverToken: string,
  ): Promise<{ ok: boolean; serverName?: string }> {
    const normalized = uri.replace(/\/+$/, "");

    try {
      const identity = await this.plexFetch<{
        MediaContainer?: { friendlyName?: string; machineIdentifier?: string };
      }>(`${normalized}/identity`, { token: serverToken });
      return {
        ok: true,
        serverName: identity.MediaContainer?.friendlyName,
      };
    } catch {
      return { ok: false };
    }
  }

  private async pmsFetch<T>(
    path: string,
    token: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const baseUrl = (await this.settings.get(PLEX_BASE_URL_SETTING))?.replace(
      /\/+$/,
      "",
    );

    if (!baseUrl) {
      throw new BadRequestException(
        "Plex base URL is not configured. Complete the setup wizard.",
      );
    }

    const url = new URL(`${baseUrl}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return this.plexFetch<T>(url.toString(), { token });
  }

  private async plexFetch<T>(
    url: string,
    options: { method?: string; token?: string } = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "X-Plex-Product": this.product,
        "X-Plex-Version": "0.1.0",
        "X-Plex-Client-Identifier": this.clientIdentifier,
        ...(options.token ? { "X-Plex-Token": options.token } : {}),
      },
    });

    const body = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Plex request failed for ${url}: HTTP ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new BadRequestException(
        `Plex did not return JSON for ${url}. Content starts with: ${body.slice(0, 120)}`,
      );
    }
  }

  private async plexResources(
    accountToken: string,
  ): Promise<{ MediaContainer: { Device?: PlexResource[] } }> {
    const response = await fetch(
      "https://plex.tv/api/resources?includeHttps=1",
      {
        headers: {
          Accept: "application/xml, application/json",
          "X-Plex-Product": this.product,
          "X-Plex-Version": "0.1.0",
          "X-Plex-Client-Identifier": this.clientIdentifier,
          "X-Plex-Token": accountToken,
        },
      },
    );
    const body = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Plex resources request failed: HTTP ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 300)}` : ""}`,
      );
    }

    if (body.trimStart().startsWith("<")) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        isArray: (name) => name === "Device" || name === "Connection",
      });
      const parsed = parser.parse(body) as {
        MediaContainer?: { Device?: Array<Record<string, unknown>> };
      };
      const devices =
        parsed.MediaContainer?.Device?.map((device) => ({
          name: String(device.name ?? ""),
          product: String(device.product ?? ""),
          provides: String(device.provides ?? ""),
          clientIdentifier: String(device.clientIdentifier ?? ""),
          accessToken:
            device.accessToken === undefined
              ? undefined
              : String(device.accessToken),
          owned: this.parsePlexBoolean(device.owned),
          ownerId: this.parsePlexNumber(device.ownerId ?? device.ownerID),
          connections: (
            device.Connection as Array<Record<string, unknown>> | undefined
          )?.map((connection) => ({
            uri: String(connection.uri ?? ""),
            local: this.parsePlexBoolean(connection.local),
          })),
        })) ?? [];

      return { MediaContainer: { Device: devices } };
    }

    return JSON.parse(body) as { MediaContainer: { Device?: PlexResource[] } };
  }

  private parsePlexBody(body: string): any {
    if (body.trimStart().startsWith("<")) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        isArray: (name) => name === "User" || name === "Device",
      });

      return parser.parse(body);
    }

    return JSON.parse(body);
  }

  private parseRating(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private extractGuidId(
    item: any,
    provider: "tmdb" | "tvdb",
  ): number | undefined {
    const ids = [
      item.guid,
      ...(item.Guid ?? []).map((guid: any) => guid.id),
    ].filter(Boolean);
    const match = ids.find((id: string) => id.startsWith(`${provider}://`));

    if (!match) {
      return undefined;
    }

    const parsed = Number(match.replace(`${provider}://`, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private normalizeMediaType(type: string | undefined): PlexMediaType {
    return type === "show" || type === "season" || type === "episode"
      ? type
      : "movie";
  }

  private get product(): string {
    return PLEX_PRODUCT;
  }

  private get clientIdentifier(): string {
    return PLEX_CLIENT_IDENTIFIER;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private parsePlexBoolean(value: unknown): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === "1" || value === 1;
  }

  private parsePlexNumber(value: unknown): number | undefined {
    if (value === undefined || value === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toArray<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }
}
