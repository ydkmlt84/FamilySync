import { describe, expect, it, vi } from "vitest";
import { RatingsService } from "./ratings.service";

function makeRatingsService() {
  const userRatings = {
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn((value) => value),
    merge: vi.fn((target, value) => Object.assign(target, value)),
    save: vi.fn(async (value) => value),
  };
  const plex = {
    getMediaMetadata: vi.fn(),
  };
  const mediaOverrides = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    merge: vi.fn((target, value) => Object.assign(target, value)),
    save: vi.fn(async (value) => value),
  };
  const users = { listEnabled: vi.fn().mockResolvedValue([]) };
  const config = { getOrThrow: vi.fn().mockReturnValue(7) };
  const settings = {
    get: vi.fn(),
    set: vi.fn(),
    getJson: vi.fn().mockImplementation((_key, fallback) => fallback),
    setJson: vi.fn(),
  };
  const radarr = {
    syncProtectedTag: vi.fn(),
    syncLowRated: vi.fn(),
  };
  const sonarr = {
    syncProtectedTag: vi.fn(),
    syncLowRated: vi.fn(),
  };
  const service = new RatingsService(
    userRatings as never,
    mediaOverrides as never,
    users as never,
    plex as never,
    settings as never,
    radarr as never,
    sonarr as never,
  );
  return {
    service,
    userRatings,
    mediaOverrides,
    users,
    config,
    settings,
    plex,
    radarr,
    sonarr,
  };
}

describe("RatingsService aggregation and display", () => {
  it("returns a sanitized public carousel", async () => {
    const { service } = makeRatingsService();
    vi.spyOn(service, "listFavorites").mockResolvedValue([
      {
        ratingKey: "perfect",
        mediaType: "movie",
        title: "Perfect",
        posterUrl: "/api/media/perfect/poster",
        highest: 10,
        average: 10,
        count: 2,
        protected: true,
        taggingExcluded: true,
        lowRated: false,
        updatedAt: new Date(),
      },
      {
        ratingKey: "private",
        mediaType: "episode",
        title: "Episode",
        posterUrl: null,
        highest: 10,
        average: 10,
        count: 1,
        protected: true,
        taggingExcluded: false,
        lowRated: false,
        updatedAt: new Date(),
      },
      {
        ratingKey: "lower",
        mediaType: "show",
        title: "Lower",
        posterUrl: null,
        highest: 9,
        average: 9,
        count: 2,
        protected: true,
        taggingExcluded: false,
        lowRated: false,
        updatedAt: new Date(),
      },
    ]);

    await expect(service.listPublicCarousel()).resolves.toEqual([
      {
        ratingKey: "perfect",
        mediaType: "movie",
        title: "Perfect",
        posterUrl: "/api/media/carousel/perfect/poster",
        average: 10,
        count: 2,
      },
    ]);
    await expect(service.isPublicCarouselItem("perfect")).resolves.toBe(true);
    await expect(service.isPublicCarouselItem("private")).resolves.toBe(false);
  });

  it("aggregates available ratings and tolerates unavailable users", async () => {
    const { service, users } = makeRatingsService();
    users.listEnabled.mockResolvedValue([
      { plexUserId: "1", plexUsername: "Alex" },
      { plexUserId: "2", plexUsername: "Sam" },
      { plexUserId: "3", plexUsername: "Taylor" },
    ]);
    const fetchAndCacheUserRating = vi
      .fn()
      .mockResolvedValueOnce({
        rating: 9,
        mediaType: "movie",
        tmdbId: 10,
      })
      .mockResolvedValueOnce({
        rating: 5,
        mediaType: "movie",
        tmdbId: 10,
      })
      .mockRejectedValueOnce(new Error("unavailable"));
    const unavailable = vi.fn().mockResolvedValue(undefined);
    const integrations = vi.fn().mockResolvedValue(undefined);
    Reflect.set(service, "fetchAndCacheUserRating", fetchAndCacheUserRating);
    Reflect.set(service, "cacheUnavailableRating", unavailable);
    Reflect.set(service, "syncIntegrations", integrations);

    await expect(service.aggregate("100", true)).resolves.toMatchObject({
      ratingKey: "100",
      highest: 9,
      average: 7,
      count: 2,
      protected: true,
    });
    expect(unavailable).toHaveBeenCalledOnce();
    expect(integrations).toHaveBeenCalledWith("movie", 10, undefined, true);
  });

  it("does not sync Sonarr tags from an episode aggregation", async () => {
    const { service, sonarr, users } = makeRatingsService();
    users.listEnabled.mockResolvedValue([
      { plexUserId: "1", plexUsername: "Alex" },
    ]);
    Reflect.set(
      service,
      "fetchAndCacheUserRating",
      vi.fn().mockResolvedValue({
        rating: 10,
        mediaType: "episode",
        tvdbId: 100,
      }),
    );

    await expect(service.aggregate("episode", true)).resolves.toMatchObject({
      protected: true,
      mediaType: "episode",
    });
    expect(sonarr.syncProtectedTag).not.toHaveBeenCalled();
    expect(sonarr.syncLowRated).not.toHaveBeenCalled();
  });

  it("lists sorted, available favorites with protection and low-rated status", async () => {
    const { service, users, userRatings, mediaOverrides } =
      makeRatingsService();
    users.listEnabled.mockResolvedValue([{ plexUserId: "1" }]);
    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-01-02T00:00:00Z");
    userRatings.find.mockResolvedValue([
      {
        ratingKey: "low",
        plexUserId: "1",
        rating: 3,
        mediaType: "movie",
        title: "Low",
        syncStatus: "rated",
        updatedAt: older,
      },
      {
        ratingKey: "high",
        plexUserId: "1",
        rating: 9,
        mediaType: "show",
        title: "High",
        syncStatus: "rated",
        updatedAt: newer,
      },
      {
        ratingKey: "missing",
        plexUserId: "1",
        rating: null,
        mediaType: "movie",
        syncStatus: "unavailable",
        updatedAt: newer,
      },
    ]);
    mediaOverrides.find.mockResolvedValue([
      { ratingKey: "high", taggingExcluded: true },
    ]);
    vi.spyOn(service, "getLowRatedSettings").mockResolvedValue({
      enabled: true,
      tagName: "low",
      averageThreshold: 4,
      minimumRatings: 1,
      removeTagsWhenNotLowRated: true,
    });

    const result = await service.listFavorites();
    expect(result.map((entry) => entry.ratingKey)).toEqual(["high", "low"]);
    expect(result[0]).toMatchObject({
      protected: true,
      taggingExcluded: true,
      lowRated: false,
    });
    expect(result[1].lowRated).toBe(true);
  });

  it("returns details for linked users only", async () => {
    const { service, users, userRatings, mediaOverrides } =
      makeRatingsService();
    users.listEnabled.mockResolvedValue([
      { plexUserId: "1", plexUsername: "Alex" },
    ]);
    userRatings.find.mockResolvedValue([
      {
        ratingKey: "100",
        plexUserId: "1",
        rating: 8,
        mediaType: "movie",
        title: "Movie",
        syncStatus: "rated",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        ratingKey: "100",
        plexUserId: "removed",
        rating: 4,
        mediaType: "movie",
        syncStatus: "rated",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    mediaOverrides.findOne.mockResolvedValue({
      ratingKey: "100",
      taggingExcluded: false,
    });

    const result = await service.getDetails("100");
    expect(result).toMatchObject({
      title: "Movie",
      highest: 8,
      average: 6,
      count: 2,
      protected: true,
    });
    expect(result.ratings).toHaveLength(1);
    expect(result.ratings[0].user).toBe("Alex");
  });

  it("reports metadata failures as sync errors in API details", async () => {
    const { service, users, userRatings, mediaOverrides } =
      makeRatingsService();
    users.listEnabled.mockResolvedValue([
      { plexUserId: "1", plexUsername: "Alex" },
    ]);
    userRatings.find.mockResolvedValue([
      {
        ratingKey: "100",
        plexUserId: "1",
        rating: null,
        mediaType: "movie",
        syncStatus: "unavailable",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    mediaOverrides.findOne.mockResolvedValue({
      ratingKey: "100",
      taggingExcluded: false,
    });

    const result = await service.getDetails("100");
    expect(result.ratings[0].syncStatus).toBe("error");
  });
});

describe("RatingsService settings, stats, and overrides", () => {
  it("gets and clamps scalar settings", async () => {
    const { service, settings } = makeRatingsService();
    settings.get
      .mockResolvedValueOnce("9")
      .mockResolvedValueOnce("invalid")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("false")
      .mockResolvedValueOnce("debug");

    await expect(service.getProtectionThreshold()).resolves.toBe(9);
    await expect(service.getProtectionThreshold()).resolves.toBe(7);
    await expect(service.getTaggingEnabled()).resolves.toBe(true);
    await expect(service.getTaggingEnabled()).resolves.toBe(false);
    await expect(service.getLogLevel()).resolves.toBe("debug");
    await expect(service.setProtectionThreshold(15)).resolves.toBe(10);
    await expect(service.setProtectionThreshold(-2)).resolves.toBe(0);
    await expect(service.setTaggingEnabled(false)).resolves.toBe(false);
    await expect(service.setLogLevel("debug")).resolves.toBe("debug");
    expect(settings.set).toHaveBeenCalledTimes(4);
  });

  it("normalizes tag settings", async () => {
    const { service, settings } = makeRatingsService();
    await expect(
      service.setProtectedTagSettings({
        enabled: true,
        tagName: "  protected ",
        removeTagsWhenUnprotected: true,
      }),
    ).resolves.toEqual({
      enabled: true,
      tagName: "protected",
      removeTagsWhenUnprotected: true,
    });
    await expect(
      service.setLowRatedSettings({
        enabled: true,
        tagName: " low ",
        averageThreshold: 20,
        minimumRatings: 2.9,
        removeTagsWhenNotLowRated: false,
      }),
    ).resolves.toEqual({
      enabled: true,
      tagName: "low",
      averageThreshold: 10,
      minimumRatings: 2,
      removeTagsWhenNotLowRated: false,
    });
    expect(settings.setJson).toHaveBeenCalledTimes(2);
  });

  it("reads posters and computes empty and populated stats", async () => {
    const { service, users, userRatings, mediaOverrides } =
      makeRatingsService();
    userRatings.findOne.mockResolvedValue({ thumb: "/poster.jpg" });
    await expect(service.getPosterPath("1")).resolves.toBe("/poster.jpg");
    await service.setPosterPath("1", "/new.jpg");
    expect(userRatings.update).toHaveBeenCalledWith(
      { ratingKey: "1" },
      { thumb: "/new.jpg" },
    );

    await expect(service.getStats()).resolves.toMatchObject({
      cachedEntries: 0,
      linkedUsers: 0,
    });

    users.listEnabled.mockResolvedValue([
      { plexUserId: "1" },
      { plexUserId: "2" },
    ]);
    userRatings.find.mockResolvedValue([
      {
        ratingKey: "movie",
        plexUserId: "1",
        rating: 9,
        mediaType: "movie",
        syncStatus: "rated",
        updatedAt: new Date(),
      },
      {
        ratingKey: "show",
        plexUserId: "2",
        rating: null,
        mediaType: "show",
        syncStatus: "unrated",
        updatedAt: new Date(),
      },
    ]);
    mediaOverrides.find.mockResolvedValue([
      { ratingKey: "movie", taggingExcluded: true },
    ]);

    await expect(service.getStats()).resolves.toMatchObject({
      cachedMovies: 1,
      cachedShows: 1,
      cachedEntries: 2,
      ratedMedia: 1,
      unratedMedia: 1,
      protectedMedia: 1,
      excludedMedia: 1,
      linkedUsers: 2,
    });
  });

  it("ignores season and episode ratings during tag sync", async () => {
    const { service, users, userRatings, radarr, sonarr } =
      makeRatingsService();
    users.listEnabled.mockResolvedValue([{ plexUserId: "1" }]);
    userRatings.find.mockResolvedValue([
      {
        ratingKey: "movie",
        plexUserId: "1",
        rating: 10,
        mediaType: "movie",
        tmdbId: 10,
        syncStatus: "rated",
      },
      {
        ratingKey: "show",
        plexUserId: "1",
        rating: 10,
        mediaType: "show",
        tvdbId: 20,
        syncStatus: "rated",
      },
      {
        ratingKey: "season",
        plexUserId: "1",
        rating: 10,
        mediaType: "season",
        tvdbId: 20,
        syncStatus: "rated",
      },
      {
        ratingKey: "episode",
        plexUserId: "1",
        rating: 10,
        mediaType: "episode",
        tvdbId: 20,
        syncStatus: "rated",
      },
    ]);

    await expect(service.syncTagsFromCache()).resolves.toEqual({
      processedMedia: 2,
      taggedMedia: 2,
      skippedMedia: 0,
    });
    expect(radarr.syncProtectedTag).toHaveBeenCalledOnce();
    expect(radarr.syncProtectedTag).toHaveBeenCalledWith(
      10,
      true,
      "family-favorite",
      false,
    );
    expect(sonarr.syncProtectedTag).toHaveBeenCalledOnce();
    expect(sonarr.syncProtectedTag).toHaveBeenCalledWith(
      20,
      true,
      "family-favorite",
      false,
    );
  });

  it("refreshes shared metadata without changing user rating values", async () => {
    const { service, plex, userRatings } = makeRatingsService();
    plex.getMediaMetadata.mockResolvedValue({
      ratingKey: "1",
      mediaType: "episode",
      title: "Pilot",
      thumb: "/season.jpg",
      grandparentTitle: "Show",
      parentIndex: 1,
      mediaIndex: 1,
      tvdbId: 100,
    });
    userRatings.update.mockResolvedValue({ affected: 2 });

    await expect(
      service.refreshCachedMetadata("1", {
        plexToken: "token",
      } as never),
    ).resolves.toBe(true);
    expect(userRatings.update).toHaveBeenCalledWith(
      { ratingKey: "1" },
      expect.objectContaining({
        displayTitle: "Show S01E01",
        thumb: "/season.jpg",
      }),
    );
    expect(userRatings.update.mock.calls[0][1]).not.toHaveProperty("rating");
    expect(userRatings.update.mock.calls[0][1].updatedAt).toBeTypeOf(
      "function",
    );
  });

  it("creates and updates media overrides and filters exclusions", async () => {
    const { service, mediaOverrides, userRatings } = makeRatingsService();
    mediaOverrides.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ratingKey: "1", taggingExcluded: false });
    userRatings.findOne
      .mockResolvedValueOnce({ ratingKey: "1", mediaType: "movie" })
      .mockResolvedValueOnce({ ratingKey: "episode", mediaType: "episode" });
    await expect(service.getMediaOverride("1")).resolves.toEqual({
      ratingKey: "1",
      taggingExcluded: false,
    });
    await expect(service.setTaggingExcluded("1", true)).resolves.toEqual({
      ratingKey: "1",
      taggingExcluded: true,
    });
    await expect(service.setTaggingExcluded("episode", true)).rejects.toThrow(
      "Only movies and shows can be excluded from tag sync.",
    );

    mediaOverrides.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ratingKey: "1", taggingExcluded: true }]);
    await expect(service.listExcludedMedia()).resolves.toEqual([]);
    vi.spyOn(service, "listFavorites").mockResolvedValue([
      { ratingKey: "1", mediaType: "movie" },
      { ratingKey: "2", mediaType: "episode" },
    ] as never);
    await expect(service.listExcludedMedia()).resolves.toEqual([
      { ratingKey: "1", mediaType: "movie" },
    ]);
  });
});
