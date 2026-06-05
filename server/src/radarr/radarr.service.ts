import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  RADARR_SETTINGS_SETTING,
  SettingsService,
} from "../settings/settings.service";

type RadarrMovie = {
  id: number;
  title: string;
  tmdbId?: number;
  tags: number[];
};

type RadarrTag = {
  id: number;
  label: string;
};

export type RadarrConnectionSettings = {
  enabled: boolean;
  url: string;
  apiKey: string;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
};

@Injectable()
export class RadarrService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async getSettings(): Promise<RadarrConnectionSettings> {
    const saved = await this.settings.getJson<
      Partial<RadarrConnectionSettings>
    >(RADARR_SETTINGS_SETTING, {});

    return {
      enabled:
        saved.enabled ?? this.config.get<boolean>("radarr.enabled") ?? false,
      url: (saved.url ?? this.config.get<string>("radarr.url") ?? "").replace(
        /\/+$/,
        "",
      ),
      apiKey: saved.apiKey ?? this.config.get<string>("radarr.apiKey") ?? "",
      tagName:
        saved.tagName ??
        this.config.get<string>("radarr.tagName") ??
        "family-favorite",
      removeTagsWhenUnprotected:
        saved.removeTagsWhenUnprotected ??
        this.config.get<boolean>("radarr.removeTagsWhenUnprotected") ??
        false,
    };
  }

  async updateSettings(
    settings: Partial<RadarrConnectionSettings>,
  ): Promise<RadarrConnectionSettings> {
    const next = await this.normalizeSettings(settings);

    await this.settings.setJson(RADARR_SETTINGS_SETTING, next);
    return next;
  }

  async testConnection(
    settings?: Partial<RadarrConnectionSettings>,
  ): Promise<{ ok: boolean; movieCount: number }> {
    const movies = await this.radarrFetch<RadarrMovie[]>(
      "/api/v3/movie",
      {},
      settings,
    );
    return { ok: true, movieCount: movies.length };
  }

  async syncProtection(
    tmdbId: number | undefined,
    isProtected: boolean,
  ): Promise<void> {
    const settings = await this.getSettings();
    await this.syncProtectedTag(
      tmdbId,
      isProtected,
      settings.tagName,
      settings.removeTagsWhenUnprotected,
    );
  }

  async syncProtectedTag(
    tmdbId: number | undefined,
    isProtected: boolean,
    tagName: string,
    removeTagsWhenUnprotected: boolean,
  ): Promise<void> {
    await this.syncTag(tmdbId, isProtected, tagName, removeTagsWhenUnprotected);
  }

  async syncLowRated(
    tmdbId: number | undefined,
    isLowRated: boolean,
    tagName: string,
    removeTagsWhenNotLowRated: boolean,
  ): Promise<void> {
    await this.syncTag(tmdbId, isLowRated, tagName, removeTagsWhenNotLowRated);
  }

  private async syncTag(
    tmdbId: number | undefined,
    shouldHaveTag: boolean,
    tagName: string,
    removeTagWhenFalse: boolean,
  ): Promise<void> {
    const settings = await this.getSettings();

    if (!settings.enabled) {
      return;
    }

    if (!tmdbId) {
      return;
    }

    const movie = await this.findMovie(tmdbId);

    if (!movie) {
      return;
    }

    const tag = await this.ensureTag(tagName);
    const hasTag = movie.tags.includes(tag.id);

    if (shouldHaveTag && !hasTag) {
      await this.updateMovieTags(movie, [...movie.tags, tag.id]);
    }

    if (!shouldHaveTag && hasTag && removeTagWhenFalse) {
      await this.updateMovieTags(
        movie,
        movie.tags.filter((tagId) => tagId !== tag.id),
      );
    }
  }

  private async findMovie(tmdbId: number): Promise<RadarrMovie | undefined> {
    const movies = await this.radarrFetch<RadarrMovie[]>("/api/v3/movie");
    return movies.find((movie) => movie.tmdbId === tmdbId);
  }

  private async ensureTag(tagName: string): Promise<RadarrTag> {
    const tags = await this.radarrFetch<RadarrTag[]>("/api/v3/tag");
    const existing = tags.find((tag) => tag.label === tagName);

    if (existing) {
      return existing;
    }

    return this.radarrFetch<RadarrTag>("/api/v3/tag", {
      method: "POST",
      body: JSON.stringify({ label: tagName }),
    });
  }

  private async updateMovieTags(
    movie: RadarrMovie,
    tags: number[],
  ): Promise<void> {
    await this.radarrFetch(`/api/v3/movie/${movie.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...movie, tags }),
    });
  }

  private async radarrFetch<T>(
    path: string,
    init: RequestInit = {},
    overrides?: Partial<RadarrConnectionSettings>,
  ): Promise<T> {
    const settings = overrides
      ? await this.normalizeSettings(overrides)
      : await this.getSettings();
    const url = settings.url;
    const apiKey = settings.apiKey;

    if (!url || !apiKey) {
      throw new BadRequestException("Radarr URL or API key is missing.");
    }

    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        "X-Api-Key": apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Radarr request failed: HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async normalizeSettings(
    settings: Partial<RadarrConnectionSettings>,
  ): Promise<RadarrConnectionSettings> {
    const current = await this.getSettings();

    return {
      ...current,
      ...settings,
      enabled: Boolean(settings.enabled),
      url: (settings.url ?? current.url).replace(/\/+$/, ""),
      apiKey: settings.apiKey?.trim() || current.apiKey,
      tagName: settings.tagName?.trim() || current.tagName || "family-favorite",
      removeTagsWhenUnprotected: Boolean(settings.removeTagsWhenUnprotected),
    };
  }
}
