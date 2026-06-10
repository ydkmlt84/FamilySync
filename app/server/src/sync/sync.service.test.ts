import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SyncService } from "./sync.service";

function makeService(overrides: Record<string, object> = {}) {
  const plex = {
    listMediaRatingKeys: vi.fn(),
    listMovieLibraries: vi.fn(),
    listLibraries: vi.fn(),
    ...overrides.plex,
  };
  const ratings = {
    pruneToRatingKeys: vi.fn(),
    listCachedRatingKeys: vi.fn(),
    refreshCachedMetadata: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ cachedMovies: 1 }),
    ...overrides.ratings,
  };
  const users = {
    listEnabled: vi.fn().mockResolvedValue([]),
    ...overrides.users,
  };
  const settings = {
    getJson: vi.fn().mockImplementation((_key, fallback) => fallback),
    setJson: vi.fn(),
    ...overrides.settings,
  };
  return {
    service: new SyncService(
      plex as never,
      ratings as never,
      users as never,
      settings as never,
    ),
    plex,
    ratings,
    users,
    settings,
  };
}

describe("SyncService settings and libraries", () => {
  it.each([
    [{ enabled: false, preset: "daily", cron: "" }, undefined],
    [{ enabled: true, preset: "disabled", cron: "" }, undefined],
    [{ enabled: true, preset: "6h", cron: "" }, "0 */6 * * *"],
    [{ enabled: true, preset: "12h", cron: "" }, "0 */12 * * *"],
    [{ enabled: true, preset: "daily", cron: "" }, "0 3 * * *"],
    [{ enabled: true, preset: "weekly", cron: "" }, "0 4 * * 0"],
    [{ enabled: true, preset: "custom", cron: " 0 5 * * * " }, "0 5 * * *"],
  ] as const)("maps cron settings", (input, expected) => {
    expect(makeService().service.cronExpression(input)).toBe(expected);
  });

  it("normalizes selected library keys", async () => {
    const { service, settings } = makeService();
    await expect(
      service.setSelectedMovieLibraryKeys(["1", "1", "", "2"]),
    ).resolves.toEqual(["1", "2"]);
    await expect(
      service.setSelectedTvLibraryKeys(["3", "3", "4"]),
    ).resolves.toEqual(["3", "4"]);
    await expect(service.setSelectedMovieLibraryKeys([])).resolves.toEqual([]);
    expect(settings.setJson).toHaveBeenLastCalledWith(
      "plex.selectedMovieLibraryKeys",
      ["__none__"],
    );
    expect(settings.setJson).toHaveBeenCalledTimes(3);
  });

  it("returns and updates job settings", async () => {
    const { service, settings } = makeService();
    await expect(service.getJobSettings()).resolves.toEqual({
      ratingSync: { enabled: false, preset: "disabled", cron: "0 3 * * *" },
      tagSync: { enabled: false, preset: "disabled", cron: "0 3 * * *" },
      metadataSync: {
        enabled: true,
        preset: "weekly",
        cron: "0 4 * * 0",
      },
    });

    await service.setJobSettings({
      ratingSync: { enabled: true, preset: "daily" },
    });
    expect(settings.setJson).toHaveBeenCalledWith(
      "jobs.ratingSync",
      expect.objectContaining({ enabled: true, preset: "daily" }),
    );

    await expect(
      service.setJobSettings({
        tagSync: { enabled: true, preset: "custom", cron: "invalid" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refreshes cached Plex metadata without rescanning user ratings", async () => {
    const user = { plexToken: "token", isAdmin: true };
    const { service, plex, ratings, users } = makeService();
    users.listEnabled.mockResolvedValue([user]);
    plex.listMediaRatingKeys.mockResolvedValue(["1", "2", "3"]);
    ratings.listCachedRatingKeys.mockResolvedValue(["1", "2", "removed"]);
    ratings.refreshCachedMetadata
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const job = service.startMetadataSync();
    await vi.waitFor(() => expect(job.status).toBe("completed"));

    expect(ratings.pruneToRatingKeys).toHaveBeenCalledWith(["1", "2", "3"]);
    expect(ratings.refreshCachedMetadata).toHaveBeenCalledTimes(2);
    expect(job).toMatchObject({
      scope: "metadata",
      trigger: "manual",
      totalMovies: 2,
      processedMovies: 2,
      syncedMovies: 2,
    });
  });

  it("persists the last run time and trigger for scheduled jobs", async () => {
    const { service, settings } = makeService();

    const job = service.startFullSync("scheduled");
    await vi.waitFor(() => expect(job.status).toBe("completed"));

    expect(settings.setJson).toHaveBeenCalledWith("jobs.ratingSync.lastRun", {
      startedAt: job.startedAt.toISOString(),
      trigger: "scheduled",
    });
  });

  it("processes full sync items with bounded concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const aggregate = vi.fn().mockImplementation(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    const user = { plexToken: "token", isAdmin: true, plexUsername: "Owner" };
    const { service, plex, users } = makeService({
      ratings: {
        isDebugLogging: vi.fn().mockResolvedValue(false),
        hasFreshCacheForAllUsers: vi.fn().mockResolvedValue(false),
        aggregate,
      },
      users: {
        listEnabled: vi.fn().mockResolvedValue([user]),
        markSynced: vi.fn(),
      },
    });
    users.listEnabled.mockResolvedValue([user]);
    plex.listMediaRatingKeys.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => String(index)),
    );

    const job = service.startFullSync();
    await vi.waitFor(() => expect(job.status).toBe("completed"));

    expect(aggregate).toHaveBeenCalledTimes(12);
    expect(maximum).toBe(4);
    expect(job.processedMovies).toBe(12);
  });

  it("lists libraries and refreshes selected media", async () => {
    const user = { plexToken: "token", isAdmin: true };
    const { service, plex, ratings, users, settings } = makeService();
    users.listEnabled.mockResolvedValue([user]);
    settings.getJson
      .mockResolvedValueOnce(["movies"])
      .mockResolvedValueOnce(["tv"])
      .mockResolvedValueOnce(["movies"])
      .mockResolvedValueOnce(["tv"]);
    plex.listMediaRatingKeys.mockResolvedValue(["1", "2"]);
    plex.listMovieLibraries.mockResolvedValue([
      { key: "movies", title: "Movies" },
      { key: "other", title: "Other" },
    ]);
    plex.listLibraries.mockResolvedValue([
      { key: "tv", title: "TV", type: "show" },
      { key: "music", title: "Music", type: "artist" },
    ]);

    await expect(service.refreshLibraryData()).resolves.toEqual({
      cachedMovies: 1,
    });
    expect(ratings.pruneToRatingKeys).toHaveBeenCalledWith(["1", "2"]);
    await expect(service.listMovieLibraries()).resolves.toMatchObject({
      selectedKeys: ["movies"],
      libraries: [
        { key: "movies", selected: true },
        { key: "other", selected: false },
      ],
    });
    await expect(service.listTvLibraries()).resolves.toMatchObject({
      selectedKeys: ["tv"],
      libraries: [{ key: "tv", selected: true }],
    });
  });

  it("returns empty libraries without linked users", async () => {
    const { service } = makeService();
    await expect(service.listMovieLibraries()).resolves.toEqual({
      libraries: [],
      selectedKeys: [],
    });
    await expect(service.listTvLibraries()).resolves.toEqual({
      libraries: [],
      selectedKeys: [],
    });
  });
});
