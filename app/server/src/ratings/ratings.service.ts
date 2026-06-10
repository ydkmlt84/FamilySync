import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Not, Repository } from "typeorm";
import { PlexService } from "../plex/plex.service";
import {
  LOG_LEVEL_SETTING,
  LOW_RATED_TAGGING_SETTING,
  PROTECTED_TAGGING_SETTING,
  RATING_PROTECTION_THRESHOLD_SETTING,
  SettingsService,
  TAGGING_ENABLED_SETTING,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";
import { LinkedUser } from "../users/linked-user.entity";
import { UserRating } from "./user-rating.entity";
import { MediaOverride } from "./media-override.entity";
import { RadarrService } from "../radarr/radarr.service";
import { SonarrService } from "../sonarr/sonarr.service";

type AggregatedUserRating = {
  user: string;
  plexUserId: string;
  rating: number;
};

export type AggregatedRating = {
  ratingKey: string;
  mediaType: UserRating["mediaType"] | null;
  ratings: AggregatedUserRating[];
  highest: number | null;
  average: number | null;
  count: number;
  protected: boolean;
};

export type FavoriteMovieRating = {
  ratingKey: string;
  mediaType: UserRating["mediaType"];
  title: string | null;
  summary: string | null;
  posterUrl: string | null;
  highest: number | null;
  average: number | null;
  count: number;
  protected: boolean;
  taggingExcluded: boolean;
  lowRated: boolean;
  updatedAt: Date;
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

export type MovieRatingDetails = FavoriteMovieRating & {
  ratings: Array<{
    plexUserId: string;
    user: string;
    rating: number | null;
    syncStatus: "rated" | "unrated" | "error";
    updatedAt: Date;
  }>;
};

export type MediaSearchResult = {
  ratingKey: string;
  title: string;
  mediaType: UserRating["mediaType"];
  year: number | null;
};

export type TagSyncResult = {
  processedMedia: number;
  taggedMedia: number;
  skippedMedia: number;
  message?: string;
};

export type AppLogLevel = "info" | "debug";

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

export type RatingCacheStats = {
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
  lastUpdatedAt: Date | null;
  protectionThreshold: number;
};

function supportsTagSync(
  mediaType: UserRating["mediaType"] | null | undefined,
): boolean {
  return mediaType === "movie" || mediaType === "show";
}

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(UserRating)
    private readonly userRatings: Repository<UserRating>,
    @InjectRepository(MediaOverride)
    private readonly mediaOverrides: Repository<MediaOverride>,
    @Inject(UsersService)
    private readonly users: UsersService,
    @Inject(PlexService)
    private readonly plex: PlexService,
    @Inject(SettingsService)
    private readonly settings: SettingsService,
    @Inject(RadarrService)
    private readonly radarr: RadarrService,
    @Inject(SonarrService)
    private readonly sonarr: SonarrService,
  ) {}

  async aggregate(
    ratingKey: string,
    syncRadarr = false,
  ): Promise<AggregatedRating> {
    const linkedUsers = await this.users.listEnabled();
    const ratings: AggregatedUserRating[] = [];
    let tmdbId: number | undefined;
    let tvdbId: number | undefined;
    let mediaType: UserRating["mediaType"] | null = null;

    for (const user of linkedUsers) {
      try {
        const result = await this.fetchAndCacheUserRating(ratingKey, user);
        tmdbId ??= result.tmdbId;
        tvdbId ??= result.tvdbId;
        mediaType ??= result.mediaType;

        if (result.rating !== null) {
          ratings.push({
            user: user.plexUsername,
            plexUserId: user.plexUserId,
            rating: result.rating,
          });
        }
      } catch {
        await this.cacheUnavailableRating(ratingKey, user);
      }
    }

    const threshold = await this.getProtectionThreshold();
    const values = ratings.map((entry) => entry.rating);
    const highest = values.length > 0 ? Math.max(...values) : null;
    const average =
      values.length > 0
        ? values.reduce((total, rating) => total + rating, 0) / values.length
        : null;
    const isProtected = values.some((rating) => rating >= threshold);

    const result = {
      ratingKey,
      mediaType,
      ratings,
      highest,
      average,
      count: ratings.length,
      protected: isProtected,
    };

    if (syncRadarr) {
      await this.syncIntegrations(mediaType, tmdbId, tvdbId, isProtected);
    }

    return result;
  }

  async listFavorites(limit = 100): Promise<FavoriteMovieRating[]> {
    const linkedUsers = await this.users.listEnabled();
    const enabledUserIds = new Set(linkedUsers.map((user) => user.plexUserId));

    if (enabledUserIds.size === 0) {
      return [];
    }

    const threshold = await this.getProtectionThreshold();
    const lowRatedSettings = await this.getLowRatedSettings();
    const overrides = await this.overridesByRatingKey();
    const cachedRatings = await this.userRatings.find({
      where: [...enabledUserIds].map((plexUserId) => ({ plexUserId })),
      order: { updatedAt: "DESC" },
    });
    const grouped = new Map<string, UserRating[]>();

    for (const rating of cachedRatings) {
      const ratings = grouped.get(rating.ratingKey) ?? [];
      ratings.push(rating);
      grouped.set(rating.ratingKey, ratings);
    }

    for (const [ratingKey, ratings] of grouped.entries()) {
      const mediaType = ratings.find((rating) => rating.mediaType)?.mediaType;
      const hasVisibleRating = ratings.some((rating) => rating.rating !== null);
      const needsDisplayMetadata =
        (mediaType === "season" || mediaType === "episode") &&
        !ratings.some((rating) => rating.displayTitle);

      if (hasVisibleRating && needsDisplayMetadata) {
        grouped.set(
          ratingKey,
          await this.ensureDisplayMetadata(ratingKey, ratings),
        );
      }
    }

    return [...grouped.entries()]
      .map(([ratingKey, ratings]) => {
        const isAvailable = ratings.some(
          (rating) => rating.syncStatus !== "unavailable",
        );
        const numericRatings = ratings.filter(
          (rating) => rating.rating !== null,
        );
        const values = numericRatings.map((rating) => rating.rating as number);
        const override = overrides.get(ratingKey);
        const mediaType =
          ratings.find((rating) => rating.mediaType)?.mediaType ?? "movie";
        const highest = values.length > 0 ? Math.max(...values) : null;
        const average =
          values.length > 0
            ? values.reduce((total, rating) => total + rating, 0) /
              values.length
            : null;
        const updatedAt = new Date(
          Math.max(...ratings.map((rating) => rating.updatedAt.getTime())),
        );

        return {
          ratingKey,
          mediaType,
          title:
            ratings.find((rating) => rating.displayTitle)?.displayTitle ??
            ratings.find((rating) => rating.title)?.title ??
            null,
          summary: ratings.find((rating) => rating.summary)?.summary ?? null,
          posterUrl: this.posterUrl(ratingKey, ratings),
          highest,
          average,
          count: values.length,
          protected: values.some((rating) => rating >= threshold),
          taggingExcluded:
            supportsTagSync(mediaType) && Boolean(override?.taggingExcluded),
          lowRated: this.isLowRated(values, lowRatedSettings),
          available: isAvailable,
          updatedAt,
        };
      })
      .filter((movie) => movie.available && movie.count > 0)
      .sort((left, right) => {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })
      .slice(0, limit);
  }

  async listPublicCarousel(limit = 20): Promise<PublicCarouselRating[]> {
    return (await this.listFavorites(1000))
      .filter(
        (media) =>
          media.average === 10 &&
          (media.mediaType === "movie" || media.mediaType === "show"),
      )
      .slice(0, limit)
      .map((media) => ({
        ratingKey: media.ratingKey,
        mediaType: media.mediaType,
        title: media.title,
        summary: media.summary,
        posterUrl: `/api/media/carousel/${media.ratingKey}/poster`,
        average: media.average,
        count: media.count,
      }));
  }

  async isPublicCarouselItem(ratingKey: string): Promise<boolean> {
    return (await this.listPublicCarousel()).some(
      (media) => media.ratingKey === ratingKey,
    );
  }

  async listCarouselRaterNames(ratingKey: string): Promise<string[]> {
    const [linkedUsers, ratings] = await Promise.all([
      this.users.listEnabled(),
      this.userRatings.find({ where: { ratingKey } }),
    ]);
    const ratedUserIds = new Set(
      ratings
        .filter((rating) => rating.rating !== null)
        .map((rating) => rating.plexUserId),
    );

    return linkedUsers
      .filter((user) => ratedUserIds.has(user.plexUserId))
      .map((user) => user.plexUsername);
  }

  async searchCachedMedia(
    query: string,
    limit = 10,
  ): Promise<MediaSearchResult[]> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      return [];
    }

    const matches = await this.userRatings.find({
      where: [
        { displayTitle: Like(`%${normalizedQuery}%`) },
        { title: Like(`%${normalizedQuery}%`) },
      ],
      order: { updatedAt: "DESC" },
      take: 100,
    });
    const unique = new Map<string, MediaSearchResult>();

    for (const match of matches) {
      if (unique.has(match.ratingKey)) {
        continue;
      }

      const title = match.displayTitle ?? match.title;

      if (!title) {
        continue;
      }

      unique.set(match.ratingKey, {
        ratingKey: match.ratingKey,
        title,
        mediaType: match.mediaType,
        year: match.year ?? null,
      });

      if (unique.size >= limit) {
        break;
      }
    }

    return [...unique.values()];
  }

  async getDetails(ratingKey: string): Promise<MovieRatingDetails> {
    const linkedUsers = await this.users.listEnabled();
    const usersByPlexId = new Map(
      linkedUsers.map((user) => [user.plexUserId, user]),
    );
    let ratings = await this.userRatings.find({
      where: { ratingKey },
      order: { updatedAt: "DESC" },
    });
    ratings = await this.ensureDisplayMetadata(ratingKey, ratings);
    const values = ratings
      .filter((rating) => rating.rating !== null)
      .map((rating) => rating.rating as number);
    const threshold = await this.getProtectionThreshold();
    const lowRatedSettings = await this.getLowRatedSettings();
    const override = await this.getMediaOverride(ratingKey);
    const mediaType =
      ratings.find((rating) => rating.mediaType)?.mediaType ?? "movie";

    return {
      ratingKey,
      title:
        ratings.find((rating) => rating.displayTitle)?.displayTitle ??
        ratings.find((rating) => rating.title)?.title ??
        null,
      summary: ratings.find((rating) => rating.summary)?.summary ?? null,
      mediaType,
      posterUrl: this.posterUrl(ratingKey, ratings),
      highest: values.length > 0 ? Math.max(...values) : null,
      average:
        values.length > 0
          ? values.reduce((total, rating) => total + rating, 0) / values.length
          : null,
      count: values.length,
      protected: values.some((rating) => rating >= threshold),
      taggingExcluded: supportsTagSync(mediaType) && override.taggingExcluded,
      lowRated: this.isLowRated(values, lowRatedSettings),
      updatedAt:
        ratings.length > 0
          ? new Date(
              Math.max(...ratings.map((rating) => rating.updatedAt.getTime())),
            )
          : new Date(),
      ratings: ratings
        .filter((rating) => usersByPlexId.has(rating.plexUserId))
        .map((rating) => ({
          plexUserId: rating.plexUserId,
          user:
            usersByPlexId.get(rating.plexUserId)?.plexUsername ??
            rating.plexUserId,
          rating: rating.rating,
          syncStatus:
            rating.syncStatus === "unavailable" ? "error" : rating.syncStatus,
          updatedAt: rating.updatedAt,
        })),
    };
  }

  async getPosterPath(ratingKey: string): Promise<string | undefined> {
    const rating = await this.userRatings.findOne({
      where: { ratingKey },
      order: { updatedAt: "DESC" },
    });

    return rating?.thumb;
  }

  async setPosterPath(ratingKey: string, thumb: string): Promise<void> {
    await this.userRatings.update({ ratingKey }, { thumb });
  }

  async listCachedRatingKeys(): Promise<string[]> {
    const rows = await this.userRatings.find({
      select: { ratingKey: true },
    });
    return [...new Set(rows.map((row) => row.ratingKey))];
  }

  async refreshCachedMetadata(
    ratingKey: string,
    user: LinkedUser,
  ): Promise<boolean> {
    const metadata = await this.plex.getMediaMetadata(
      ratingKey,
      user.plexToken,
    );
    const seriesTvdbId = await this.resolveSeriesTvdbId(metadata, user);
    const result = await this.userRatings.update(
      { ratingKey },
      {
        mediaType: metadata.mediaType,
        title: metadata.title,
        displayTitle: this.displayTitle(metadata),
        summary: metadata.summary,
        thumb: metadata.thumb,
        parentTitle: metadata.parentTitle,
        grandparentTitle: metadata.grandparentTitle,
        parentRatingKey: metadata.parentRatingKey,
        grandparentRatingKey: metadata.grandparentRatingKey,
        year: metadata.year,
        mediaIndex: metadata.mediaIndex,
        parentIndex: metadata.parentIndex,
        tmdbId: metadata.tmdbId,
        tvdbId: seriesTvdbId ?? metadata.tvdbId,
        updatedAt: () => '"updatedAt"',
      },
    );
    return Boolean(result.affected);
  }

  async getStats(): Promise<RatingCacheStats> {
    const linkedUsers = await this.users.listEnabled();
    const enabledUserIds = new Set(linkedUsers.map((user) => user.plexUserId));

    if (enabledUserIds.size === 0) {
      return {
        cachedMovies: 0,
        cachedShows: 0,
        cachedSeasons: 0,
        cachedEpisodes: 0,
        cachedEntries: 0,
        ratedMedia: 0,
        unratedMedia: 0,
        protectedMedia: 0,
        excludedMedia: 0,
        linkedUsers: 0,
        lastUpdatedAt: null,
        protectionThreshold: await this.getProtectionThreshold(),
      };
    }

    const cachedRatings = await this.userRatings.find({
      where: [...enabledUserIds].map((plexUserId) => ({ plexUserId })),
      order: { updatedAt: "DESC" },
    });
    const grouped = new Map<string, UserRating[]>();

    for (const rating of cachedRatings) {
      const ratings = grouped.get(rating.ratingKey) ?? [];
      ratings.push(rating);
      grouped.set(rating.ratingKey, ratings);
    }

    const mediaCounts = {
      movie: 0,
      show: 0,
      season: 0,
      episode: 0,
    };
    let ratedMedia = 0;
    let unratedMedia = 0;
    let protectedMedia = 0;
    const threshold = await this.getProtectionThreshold();
    const excludedKeys = new Set(
      (
        await this.mediaOverrides.find({ where: { taggingExcluded: true } })
      ).map((override) => override.ratingKey),
    );

    for (const ratings of grouped.values()) {
      const mediaType = ratings.find((rating) => rating.mediaType)?.mediaType;

      if (mediaType) {
        mediaCounts[mediaType] += 1;
      }

      if (ratings.some((rating) => rating.rating !== null)) {
        ratedMedia += 1;
        if (
          ratings.some(
            (rating) => rating.rating !== null && rating.rating >= threshold,
          )
        ) {
          protectedMedia += 1;
        }
      } else if (
        ratings.some((rating) => rating.syncStatus !== "unavailable")
      ) {
        unratedMedia += 1;
      }
    }

    return {
      cachedMovies: mediaCounts.movie,
      cachedShows: mediaCounts.show,
      cachedSeasons: mediaCounts.season,
      cachedEpisodes: mediaCounts.episode,
      cachedEntries: cachedRatings.length,
      ratedMedia,
      unratedMedia,
      protectedMedia,
      excludedMedia: [...grouped.entries()].filter(
        ([key, ratings]) =>
          excludedKeys.has(key) &&
          supportsTagSync(
            ratings.find((rating) => rating.mediaType)?.mediaType,
          ),
      ).length,
      linkedUsers: linkedUsers.length,
      lastUpdatedAt: cachedRatings[0]?.updatedAt ?? null,
      protectionThreshold: await this.getProtectionThreshold(),
    };
  }

  async getProtectionThreshold(): Promise<number> {
    const configured = await this.settings.get(
      RATING_PROTECTION_THRESHOLD_SETTING,
    );
    const fallback = 7;
    const value = Number(configured ?? fallback);

    return Number.isFinite(value) ? value : fallback;
  }

  async setProtectionThreshold(value: number): Promise<number> {
    const normalized = Math.min(10, Math.max(0, Number(value)));

    if (!Number.isFinite(normalized)) {
      return this.getProtectionThreshold();
    }

    await this.settings.set(
      RATING_PROTECTION_THRESHOLD_SETTING,
      String(normalized),
    );
    return normalized;
  }

  async getTaggingEnabled(): Promise<boolean> {
    const configured = await this.settings.get(TAGGING_ENABLED_SETTING);

    return configured === undefined ? true : configured === "true";
  }

  async setTaggingEnabled(enabled: boolean): Promise<boolean> {
    const normalized = Boolean(enabled);
    await this.settings.set(TAGGING_ENABLED_SETTING, String(normalized));
    return normalized;
  }

  async getLogLevel(): Promise<AppLogLevel> {
    const configured = await this.settings.get(LOG_LEVEL_SETTING);

    return configured === "debug" ? "debug" : "info";
  }

  async setLogLevel(level: AppLogLevel): Promise<AppLogLevel> {
    const normalized: AppLogLevel = level === "debug" ? "debug" : "info";
    await this.settings.set(LOG_LEVEL_SETTING, normalized);
    return normalized;
  }

  async isDebugLogging(): Promise<boolean> {
    return (await this.getLogLevel()) === "debug";
  }

  async getLowRatedSettings(): Promise<LowRatedSettings> {
    return this.settings.getJson<LowRatedSettings>(LOW_RATED_TAGGING_SETTING, {
      enabled: false,
      tagName: "family-low-rated",
      averageThreshold: 4,
      minimumRatings: 2,
      removeTagsWhenNotLowRated: true,
    });
  }

  async getProtectedTagSettings(): Promise<ProtectedTagSettings> {
    return this.settings.getJson<ProtectedTagSettings>(
      PROTECTED_TAGGING_SETTING,
      {
        enabled: true,
        tagName: "family-favorite",
        removeTagsWhenUnprotected: false,
      },
    );
  }

  async setProtectedTagSettings(
    settings: Partial<ProtectedTagSettings>,
  ): Promise<ProtectedTagSettings> {
    const current = await this.getProtectedTagSettings();
    const next: ProtectedTagSettings = {
      ...current,
      ...settings,
      enabled: Boolean(settings.enabled),
      tagName: settings.tagName?.trim() || current.tagName || "family-favorite",
      removeTagsWhenUnprotected: Boolean(settings.removeTagsWhenUnprotected),
    };

    await this.settings.setJson(PROTECTED_TAGGING_SETTING, next);
    return next;
  }

  async listExcludedMedia(): Promise<FavoriteMovieRating[]> {
    const excluded = await this.mediaOverrides.find({
      where: { taggingExcluded: true },
    });
    const excludedKeys = new Set(
      excluded.map((override) => override.ratingKey),
    );

    if (excludedKeys.size === 0) {
      return [];
    }

    return (await this.listFavorites(1000)).filter(
      (media) =>
        supportsTagSync(media.mediaType) && excludedKeys.has(media.ratingKey),
    );
  }

  async setLowRatedSettings(
    settings: Partial<LowRatedSettings>,
  ): Promise<LowRatedSettings> {
    const current = await this.getLowRatedSettings();
    const averageThreshold = Number(
      settings.averageThreshold ?? current.averageThreshold,
    );
    const minimumRatings = Number(
      settings.minimumRatings ?? current.minimumRatings,
    );
    const next: LowRatedSettings = {
      ...current,
      ...settings,
      enabled: Boolean(settings.enabled),
      tagName:
        settings.tagName?.trim() || current.tagName || "family-low-rated",
      averageThreshold: Number.isFinite(averageThreshold)
        ? Math.min(10, Math.max(0, averageThreshold))
        : current.averageThreshold,
      minimumRatings: Number.isFinite(minimumRatings)
        ? Math.max(1, Math.floor(minimumRatings))
        : current.minimumRatings,
      removeTagsWhenNotLowRated: Boolean(settings.removeTagsWhenNotLowRated),
    };

    await this.settings.setJson(LOW_RATED_TAGGING_SETTING, next);
    return next;
  }

  async getMediaOverride(ratingKey: string): Promise<MediaOverride> {
    return (
      (await this.mediaOverrides.findOne({ where: { ratingKey } })) ??
      this.mediaOverrides.create({ ratingKey, taggingExcluded: false })
    );
  }

  async setTaggingExcluded(
    ratingKey: string,
    taggingExcluded: boolean,
  ): Promise<MediaOverride> {
    const rating = await this.userRatings.findOne({ where: { ratingKey } });

    if (!supportsTagSync(rating?.mediaType)) {
      throw new BadRequestException(
        "Only movies and shows can be excluded from tag sync.",
      );
    }

    const existing = await this.mediaOverrides.findOne({
      where: { ratingKey },
    });

    return this.mediaOverrides.save(
      this.mediaOverrides.merge(
        existing ?? this.mediaOverrides.create({ ratingKey }),
        { taggingExcluded },
      ),
    );
  }

  async syncTagsFromCache(): Promise<TagSyncResult> {
    const linkedUsers = await this.users.listEnabled();
    const enabledUserIds = new Set(linkedUsers.map((user) => user.plexUserId));

    if (enabledUserIds.size === 0) {
      this.logger.log("Tag sync skipped: no enabled linked users.");
      return {
        processedMedia: 0,
        taggedMedia: 0,
        skippedMedia: 0,
        message: "No enabled linked users.",
      };
    }

    const threshold = await this.getProtectionThreshold();
    const protectedSettings = await this.getProtectedTagSettings();
    const lowRatedSettings = await this.getLowRatedSettings();
    const overrides = await this.overridesByRatingKey();
    const debug = await this.isDebugLogging();
    const cachedRatings = await this.userRatings.find({
      where: [...enabledUserIds].map((plexUserId) => ({ plexUserId })),
    });
    const grouped = new Map<string, UserRating[]>();
    const result: TagSyncResult = {
      processedMedia: 0,
      taggedMedia: 0,
      skippedMedia: 0,
    };

    for (const rating of cachedRatings) {
      const ratings = grouped.get(rating.ratingKey) ?? [];
      ratings.push(rating);
      grouped.set(rating.ratingKey, ratings);
    }

    for (const ratings of grouped.values()) {
      const mediaType = ratings.find((rating) => rating.mediaType)?.mediaType;

      if (mediaType === "season" || mediaType === "episode") {
        if (debug) {
          this.logger.debug(
            `Tag sync ignored ${ratings[0]?.ratingKey}: ${mediaType} ratings do not affect Sonarr series tags.`,
          );
        }
        continue;
      }

      const values = ratings
        .filter((rating) => rating.rating !== null)
        .map((rating) => rating.rating as number);

      if (values.length === 0) {
        continue;
      }

      const source = ratings.find(
        (rating) => rating.syncStatus !== "unavailable",
      );
      const isProtected = values.some((rating) => rating >= threshold);
      const isLowRated = this.isLowRated(values, lowRatedSettings);

      if (!source) {
        result.skippedMedia += 1;
        if (debug) {
          this.logger.debug(
            `Tag sync skipped ${ratings[0]?.ratingKey}: no available cache row.`,
          );
        }
        continue;
      }

      if (overrides.get(source.ratingKey)?.taggingExcluded) {
        result.skippedMedia += 1;
        if (debug) {
          this.logger.debug(
            `Tag sync skipped ${source.ratingKey}: tagging excluded by admin override.`,
          );
        }
        continue;
      }

      result.processedMedia += 1;
      if (debug) {
        this.logger.debug(
          `Tag sync processing ${source.ratingKey}: mediaType=${source.mediaType}, protected=${isProtected}, lowRated=${isLowRated}, tmdbId=${source.tmdbId ?? "none"}, tvdbId=${source.tvdbId ?? "none"}.`,
        );
      }
      await this.syncIntegrations(
        source.mediaType,
        source.tmdbId,
        source.tvdbId,
        isProtected,
        protectedSettings,
        isLowRated,
        lowRatedSettings,
      );

      if (isProtected) {
        result.taggedMedia += 1;
      }
    }

    return result;
  }

  async pruneToRatingKeys(ratingKeys: string[]): Promise<void> {
    if (ratingKeys.length === 0) {
      return;
    }

    await this.userRatings.delete({ ratingKey: Not(In(ratingKeys)) });
  }

  async hasFreshCacheForAllUsers(
    ratingKey: string,
    users: LinkedUser[],
    maxAgeMs: number,
  ): Promise<boolean> {
    if (users.length === 0) {
      return false;
    }

    const cutoff = Date.now() - maxAgeMs;
    const rows = await this.userRatings.find({
      where: {
        ratingKey,
        plexUserId: In(users.map((user) => user.plexUserId)),
      },
    });

    if (rows.length < users.length) {
      return false;
    }

    return rows.every((row) => this.isFreshCacheRow(row, cutoff));
  }

  async hasFreshCacheForUser(
    ratingKey: string,
    user: LinkedUser,
    maxAgeMs: number,
  ): Promise<boolean> {
    const row = await this.userRatings.findOne({
      where: { ratingKey, plexUserId: user.plexUserId },
    });

    return Boolean(row && this.isFreshCacheRow(row, Date.now() - maxAgeMs));
  }

  async fetchAndCacheUserRating(
    ratingKey: string,
    user: LinkedUser,
  ): Promise<{
    rating: number | null;
    mediaType: UserRating["mediaType"];
    tmdbId?: number;
    tvdbId?: number;
  }> {
    const metadata = await this.plex.getMediaMetadata(
      ratingKey,
      user.plexToken,
    );
    const seriesTvdbId = await this.resolveSeriesTvdbId(metadata, user);
    const tvdbId = seriesTvdbId ?? metadata.tvdbId;

    if (metadata.userRating === undefined) {
      await this.saveRatingState({
        ratingKey,
        mediaType: metadata.mediaType,
        title: metadata.title,
        displayTitle: this.displayTitle(metadata),
        summary: metadata.summary,
        thumb: metadata.thumb,
        parentTitle: metadata.parentTitle,
        grandparentTitle: metadata.grandparentTitle,
        parentRatingKey: metadata.parentRatingKey,
        grandparentRatingKey: metadata.grandparentRatingKey,
        year: metadata.year,
        mediaIndex: metadata.mediaIndex,
        parentIndex: metadata.parentIndex,
        tmdbId: metadata.tmdbId,
        tvdbId,
        plexUserId: user.plexUserId,
        rating: null,
        syncStatus: "unrated",
      });
      return {
        rating: null,
        mediaType: metadata.mediaType,
        tmdbId: metadata.tmdbId,
        tvdbId,
      };
    }

    await this.saveRatingState({
      ratingKey,
      mediaType: metadata.mediaType,
      title: metadata.title,
      displayTitle: this.displayTitle(metadata),
      summary: metadata.summary,
      thumb: metadata.thumb,
      parentTitle: metadata.parentTitle,
      grandparentTitle: metadata.grandparentTitle,
      parentRatingKey: metadata.parentRatingKey,
      grandparentRatingKey: metadata.grandparentRatingKey,
      year: metadata.year,
      mediaIndex: metadata.mediaIndex,
      parentIndex: metadata.parentIndex,
      tmdbId: metadata.tmdbId,
      tvdbId,
      plexUserId: user.plexUserId,
      rating: metadata.userRating,
      syncStatus: "rated",
    });

    return {
      rating: metadata.userRating,
      mediaType: metadata.mediaType,
      tmdbId: metadata.tmdbId,
      tvdbId,
    };
  }

  async cacheUnavailableRating(
    ratingKey: string,
    user: LinkedUser,
  ): Promise<void> {
    const existing = await this.userRatings.findOne({
      where: { ratingKey, plexUserId: user.plexUserId },
    });

    await this.saveRatingState({
      ratingKey,
      mediaType: existing?.mediaType ?? "movie",
      plexUserId: user.plexUserId,
      rating: null,
      syncStatus: "unavailable",
    });
  }

  private async saveRatingState({
    ratingKey,
    mediaType,
    title,
    displayTitle,
    summary,
    thumb,
    parentTitle,
    grandparentTitle,
    parentRatingKey,
    grandparentRatingKey,
    year,
    mediaIndex,
    parentIndex,
    tmdbId,
    tvdbId,
    plexUserId,
    rating,
    syncStatus,
  }: {
    ratingKey: string;
    mediaType: UserRating["mediaType"];
    title?: string;
    displayTitle?: string;
    summary?: string;
    thumb?: string;
    parentTitle?: string;
    grandparentTitle?: string;
    parentRatingKey?: string;
    grandparentRatingKey?: string;
    year?: number;
    mediaIndex?: number;
    parentIndex?: number;
    tmdbId?: number;
    tvdbId?: number;
    plexUserId: string;
    rating: number | null;
    syncStatus: UserRating["syncStatus"];
  }): Promise<UserRating> {
    const existing = await this.userRatings.findOne({
      where: { ratingKey, plexUserId },
    });
    const entity = this.userRatings.merge(
      existing ?? this.userRatings.create(),
      {
        ratingKey,
        mediaType: mediaType ?? existing?.mediaType ?? "movie",
        title: title ?? existing?.title,
        displayTitle: displayTitle ?? existing?.displayTitle,
        summary: summary ?? existing?.summary,
        thumb: thumb ?? existing?.thumb,
        parentTitle: parentTitle ?? existing?.parentTitle,
        grandparentTitle: grandparentTitle ?? existing?.grandparentTitle,
        parentRatingKey: parentRatingKey ?? existing?.parentRatingKey,
        grandparentRatingKey:
          grandparentRatingKey ?? existing?.grandparentRatingKey,
        year: year ?? existing?.year,
        mediaIndex: mediaIndex ?? existing?.mediaIndex,
        parentIndex: parentIndex ?? existing?.parentIndex,
        tmdbId: tmdbId ?? existing?.tmdbId,
        tvdbId: tvdbId ?? existing?.tvdbId,
        plexUserId,
        rating,
        syncStatus,
      },
    );

    return this.userRatings.save(entity);
  }

  private posterUrl(ratingKey: string, ratings: UserRating[]): string | null {
    return ratings.length > 0 ? `/api/media/${ratingKey}/poster` : null;
  }

  private async syncIntegrations(
    mediaType: UserRating["mediaType"] | null,
    tmdbId: number | undefined,
    tvdbId: number | undefined,
    isProtected: boolean,
    protectedSettings?: ProtectedTagSettings,
    isLowRated = false,
    lowRatedSettings?: LowRatedSettings,
  ): Promise<void> {
    if (mediaType === "movie") {
      if (protectedSettings?.enabled ?? true) {
        await this.radarr.syncProtectedTag(
          tmdbId,
          isProtected,
          protectedSettings?.tagName ?? "family-favorite",
          protectedSettings?.removeTagsWhenUnprotected ?? false,
        );
      }
      if (lowRatedSettings?.enabled) {
        await this.radarr.syncLowRated(
          tmdbId,
          isLowRated,
          lowRatedSettings.tagName,
          lowRatedSettings.removeTagsWhenNotLowRated,
        );
      }
      return;
    }

    if (mediaType === "show") {
      if (protectedSettings?.enabled ?? true) {
        await this.sonarr.syncProtectedTag(
          tvdbId,
          isProtected,
          protectedSettings?.tagName ?? "family-favorite",
          protectedSettings?.removeTagsWhenUnprotected ?? false,
        );
      }
      if (lowRatedSettings?.enabled) {
        await this.sonarr.syncLowRated(
          tvdbId,
          isLowRated,
          lowRatedSettings.tagName,
          lowRatedSettings.removeTagsWhenNotLowRated,
        );
      }
    }
  }

  private isLowRated(values: number[], settings: LowRatedSettings): boolean {
    if (!settings.enabled || values.length < settings.minimumRatings) {
      return false;
    }

    const average =
      values.reduce((total, rating) => total + rating, 0) / values.length;
    return average <= settings.averageThreshold;
  }

  private async overridesByRatingKey(): Promise<Map<string, MediaOverride>> {
    const overrides = await this.mediaOverrides.find();
    return new Map(overrides.map((override) => [override.ratingKey, override]));
  }

  private async resolveSeriesTvdbId(
    metadata: {
      mediaType: UserRating["mediaType"];
      parentRatingKey?: string;
      grandparentRatingKey?: string;
      tvdbId?: number;
    },
    user: LinkedUser,
  ): Promise<number | undefined> {
    if (metadata.mediaType === "movie" || metadata.mediaType === "show") {
      return metadata.tvdbId;
    }

    const showRatingKey =
      metadata.grandparentRatingKey ?? metadata.parentRatingKey;

    if (!showRatingKey) {
      return metadata.tvdbId;
    }

    try {
      return (await this.plex.getMediaMetadata(showRatingKey, user.plexToken))
        .tvdbId;
    } catch {
      return metadata.tvdbId;
    }
  }

  private displayTitle(metadata: {
    mediaType: UserRating["mediaType"];
    title?: string;
    parentTitle?: string;
    grandparentTitle?: string;
    mediaIndex?: number;
    parentIndex?: number;
  }): string | undefined {
    if (metadata.mediaType === "episode") {
      const showTitle = metadata.grandparentTitle ?? metadata.title;

      if (
        showTitle &&
        metadata.parentIndex !== undefined &&
        metadata.mediaIndex !== undefined
      ) {
        return `${showTitle} S${String(metadata.parentIndex).padStart(2, "0")}E${String(metadata.mediaIndex).padStart(2, "0")}`;
      }

      return showTitle;
    }

    if (metadata.mediaType === "season") {
      const showTitle = metadata.parentTitle ?? metadata.title;

      if (showTitle && metadata.mediaIndex !== undefined) {
        return `${showTitle} S${String(metadata.mediaIndex).padStart(2, "0")}`;
      }

      return showTitle;
    }

    return metadata.title;
  }

  private async ensureDisplayMetadata(
    ratingKey: string,
    ratings: UserRating[],
  ): Promise<UserRating[]> {
    const mediaType = ratings.find((rating) => rating.mediaType)?.mediaType;

    if (
      mediaType !== "season" &&
      mediaType !== "episode" &&
      mediaType !== "show"
    ) {
      return ratings;
    }

    if (ratings.some((rating) => rating.displayTitle)) {
      return ratings;
    }

    const linkedUsers = await this.users.listEnabled();
    const sourceUser = linkedUsers.find((user) => user.enabled);

    if (!sourceUser) {
      return ratings;
    }

    try {
      const metadata = await this.plex.getMediaMetadata(
        ratingKey,
        sourceUser.plexToken,
      );
      const displayTitle = this.displayTitle(metadata);

      await this.userRatings.update(
        { ratingKey },
        {
          mediaType: metadata.mediaType,
          title: metadata.title,
          displayTitle,
          summary: metadata.summary,
          thumb: metadata.thumb,
          parentTitle: metadata.parentTitle,
          grandparentTitle: metadata.grandparentTitle,
          parentRatingKey: metadata.parentRatingKey,
          grandparentRatingKey: metadata.grandparentRatingKey,
          mediaIndex: metadata.mediaIndex,
          parentIndex: metadata.parentIndex,
          tvdbId: metadata.tvdbId,
        },
      );

      return this.userRatings.find({
        where: { ratingKey },
        order: { updatedAt: "DESC" },
      });
    } catch {
      return ratings;
    }
  }

  private isFreshCacheRow(row: UserRating, cutoff: number): boolean {
    if (row.updatedAt.getTime() < cutoff) {
      return false;
    }

    if (
      (row.mediaType === "season" || row.mediaType === "episode") &&
      !row.displayTitle
    ) {
      return false;
    }

    return true;
  }
}
