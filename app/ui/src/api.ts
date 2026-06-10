export type LinkedUser = {
  id: string;
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
  enabled: boolean;
  isAdmin: boolean;
  isManaged: boolean;
  managedByPlexUserId?: string;
  plexServerIdentifier?: string;
  plexServerName?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
};

export type ManagedHomeUser = {
  id: string;
  title: string;
  thumb?: string;
  restricted: boolean;
  protected: boolean;
  linked: boolean;
};

export type AggregatedRating = {
  ratingKey: string;
  mediaType: "movie" | "show" | "season" | "episode" | null;
  ratings: Array<{ user: string; plexUserId: string; rating: number }>;
  highest: number | null;
  average: number | null;
  count: number;
  protected: boolean;
};

export type FavoriteMovieRating = {
  ratingKey: string;
  mediaType: "movie" | "show" | "season" | "episode";
  title: string | null;
  summary: string | null;
  posterUrl: string | null;
  highest: number | null;
  average: number | null;
  count: number;
  protected: boolean;
  taggingExcluded: boolean;
  lowRated: boolean;
  updatedAt: string;
};

export type PublicCarouselRating = Pick<
  FavoriteMovieRating,
  | "ratingKey"
  | "mediaType"
  | "title"
  | "summary"
  | "posterUrl"
  | "average"
  | "count"
>;

export type CarouselRaters = {
  names: string[];
};

export type MediaSearchResult = {
  ratingKey: string;
  title: string;
  mediaType: FavoriteMovieRating["mediaType"];
  year: number | null;
};

export type MovieRatingDetails = FavoriteMovieRating & {
  ratings: Array<{
    plexUserId: string;
    user: string;
    rating: number | null;
    syncStatus: "rated" | "unrated" | "error";
    updatedAt: string;
  }>;
};

export type SyncStats = {
  cachedMovies: number;
  cachedShows: number;
  cachedSeasons: number;
  cachedEpisodes: number;
  cachedEntries: number;
  ratedMedia: number;
  unratedMedia: number;
  protectedMedia: number;
  excludedMedia: number;
  linkedUsers: number;
  lastUpdatedAt: string | null;
  protectionThreshold: number;
};

export type MovieLibrarySelection = {
  libraries: Array<{
    key: string;
    title: string;
    count?: number;
    selected: boolean;
  }>;
  selectedKeys: string[];
};

export type IntegrationSettings = {
  enabled: boolean;
  url: string;
  apiKey?: string;
  apiKeyConfigured: boolean;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
};

export type LowRatedSettings = {
  enabled: boolean;
  tagName: string;
  averageThreshold: number;
  minimumRatings: number;
  removeTagsWhenNotLowRated: boolean;
};

export type ProtectedTagSettings = {
  enabled: boolean;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
};

export type SyncJobStatus = {
  id: string;
  label: string;
  scope: "full" | "user" | "tags" | "metadata";
  trigger: "manual" | "scheduled";
  status: "running" | "completed" | "failed";
  totalMovies: number;
  processedMovies: number;
  syncedMovies: number;
  skippedMovies: number;
  cachedSkips: number;
  users: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type CronPreset =
  | "disabled"
  | "6h"
  | "12h"
  | "daily"
  | "weekly"
  | "custom";

export type CronJobSettings = {
  enabled: boolean;
  preset: CronPreset;
  cron: string;
  lastRun?: {
    startedAt: string;
    trigger: SyncJobStatus["trigger"];
  };
};

export type JobsSettings = {
  ratingSync: CronJobSettings;
  tagSync: CronJobSettings;
  metadataSync: CronJobSettings;
};

export type SetupStatus = {
  setupRequired: boolean;
  needsFirstAdmin: boolean;
  serverConfigured: boolean;
};

export type ServerConnectionCandidate = {
  uri: string;
  local: boolean;
};

export type ServerCandidates = {
  serverName?: string;
  clientIdentifier?: string;
  currentBaseUrl?: string;
  candidates: ServerConnectionCandidate[];
};

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = "";

    try {
      const body = (await response.json()) as {
        message?: string | string[];
        error?: string;
      };
      detail = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message || body.error || "";
    } catch {
      detail = await response.text();
    }

    throw new Error(
      [`HTTP ${response.status} ${response.statusText}`, detail]
        .filter(Boolean)
        .join(": "),
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  createPin: () =>
    apiFetch<{ pinId: number; code: string; authUrl: string }>(
      "/auth/plex/pin",
      { method: "POST" },
    ),
  getSetupStatus: () => apiFetch<SetupStatus>("/auth/plex/setup"),
  pollPin: (pinId: number) =>
    apiFetch<{
      linked: boolean;
      action?: "linked" | "signed-in";
      user?: LinkedUser;
    }>(`/auth/plex/pin/${pinId}`),
  getServerCandidates: () =>
    apiFetch<ServerCandidates>("/auth/plex/server-candidates"),
  testServerConnection: (uri: string) =>
    apiFetch<{ ok: boolean; serverName?: string }>(
      "/auth/plex/test-connection",
      { method: "POST", body: JSON.stringify({ uri }) },
    ),
  saveServerConfig: (baseUrl: string) =>
    apiFetch<SetupStatus>("/auth/plex/server-config", {
      method: "POST",
      body: JSON.stringify({ baseUrl }),
    }),
  me: () => apiFetch<LinkedUser>("/auth/me"),
  logout: () =>
    apiFetch<{ loggedOut: boolean }>("/auth/logout", { method: "POST" }),
  unlinkSelf: () =>
    apiFetch<{ removed: boolean }>("/auth/me", { method: "DELETE" }),
  listUsers: () => apiFetch<LinkedUser[]>("/users"),
  listManagedHomeUsers: () =>
    apiFetch<ManagedHomeUser[]>("/users/managed-home"),
  importManagedHomeUser: (plexUserId: string, pin?: string) =>
    apiFetch<LinkedUser>(`/users/managed-home/${plexUserId}`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  setUserEnabled: (id: string, enabled: boolean) =>
    apiFetch<LinkedUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  removeUser: (id: string) =>
    apiFetch<{ removed: boolean }>(`/users/${id}`, { method: "DELETE" }),
  getSyncStats: () => apiFetch<SyncStats>("/sync/stats"),
  refreshSyncStats: () =>
    apiFetch<SyncStats>("/sync/stats/refresh", { method: "POST" }),
  getSyncSettings: () =>
    apiFetch<{
      protectionThreshold: number;
      taggingEnabled: boolean;
      logLevel: "info" | "debug";
      protectedTag: ProtectedTagSettings;
      lowRated: LowRatedSettings;
      radarr: IntegrationSettings;
      sonarr: IntegrationSettings;
    }>("/sync/settings"),
  updateSyncSettings: (body: {
    protectionThreshold?: number;
    taggingEnabled?: boolean;
    logLevel?: "info" | "debug";
    protectedTag?: ProtectedTagSettings;
    lowRated?: LowRatedSettings;
    radarr?: IntegrationSettings;
    sonarr?: IntegrationSettings;
  }) =>
    apiFetch<{
      protectionThreshold: number;
      taggingEnabled: boolean;
      logLevel: "info" | "debug";
      protectedTag: ProtectedTagSettings;
      lowRated: LowRatedSettings;
      radarr: IntegrationSettings;
      sonarr: IntegrationSettings;
    }>("/sync/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  testRadarr: (settings: IntegrationSettings) =>
    apiFetch<{ ok: boolean; movieCount: number }>(
      "/sync/settings/radarr/test",
      {
        method: "POST",
        body: JSON.stringify(settings),
      },
    ),
  testSonarr: (settings: IntegrationSettings) =>
    apiFetch<{ ok: boolean; seriesCount: number }>(
      "/sync/settings/sonarr/test",
      { method: "POST", body: JSON.stringify(settings) },
    ),
  getMovieLibraries: () => apiFetch<MovieLibrarySelection>("/sync/libraries"),
  getTvLibraries: () => apiFetch<MovieLibrarySelection>("/sync/libraries/tv"),
  updateMovieLibraries: (selectedKeys: string[]) =>
    apiFetch<string[]>("/sync/libraries", {
      method: "POST",
      body: JSON.stringify({ selectedKeys }),
    }),
  updateTvLibraries: (selectedKeys: string[]) =>
    apiFetch<string[]>("/sync/libraries/tv", {
      method: "POST",
      body: JSON.stringify({ selectedKeys }),
    }),
  forceSync: () => apiFetch<SyncJobStatus>("/sync", { method: "POST" }),
  syncTags: () => apiFetch<SyncJobStatus>("/sync/tags", { method: "POST" }),
  syncMetadata: () =>
    apiFetch<SyncJobStatus>("/sync/metadata", { method: "POST" }),
  syncUser: (id: string) =>
    apiFetch<SyncJobStatus>(`/sync/users/${id}`, { method: "POST" }),
  getSyncJob: (id: string) => apiFetch<SyncJobStatus>(`/sync/jobs/${id}`),
  getJobsSettings: () => apiFetch<JobsSettings>("/sync/jobs/settings"),
  updateJobsSettings: (settings: Partial<JobsSettings>) =>
    apiFetch<JobsSettings>("/sync/jobs/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  listFavorites: () => apiFetch<FavoriteMovieRating[]>("/media/favorites"),
  listPublicCarousel: () => apiFetch<PublicCarouselRating[]>("/media/carousel"),
  getCarouselRaters: (ratingKey: string) =>
    apiFetch<CarouselRaters>(`/media/carousel/${ratingKey}/raters`),
  searchMedia: (query: string) =>
    apiFetch<MediaSearchResult[]>(
      `/media/search?query=${encodeURIComponent(query)}`,
    ),
  listExcluded: () => apiFetch<FavoriteMovieRating[]>("/media/excluded"),
  getRatingDetails: (ratingKey: string) =>
    apiFetch<MovieRatingDetails>(`/media/${ratingKey}/details`),
  updateMediaOverride: (ratingKey: string, taggingExcluded: boolean) =>
    apiFetch<MovieRatingDetails>(`/media/${ratingKey}/override`, {
      method: "PATCH",
      body: JSON.stringify({ taggingExcluded }),
    }),
  getRating: (ratingKey: string) =>
    apiFetch<AggregatedRating>(`/media/${ratingKey}`),
};
