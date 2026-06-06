import { NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { SessionController } from "./auth/session.controller";
import { AuthGuard } from "./auth/auth.guard";
import { RatingsController } from "./ratings/ratings.controller";
import { SyncController } from "./sync/sync.controller";
import { UsersController } from "./users/users.controller";

describe("SessionController", () => {
  it("returns safe users, logs out, and unlinks accounts", async () => {
    const sessions = {
      revokeToken: vi.fn(),
      revokeUserSessions: vi.fn(),
    };
    const users = { remove: vi.fn() };
    const response = { clearCookie: vi.fn() };
    const sessionCookie = { clear: vi.fn() };
    const controller = new SessionController(
      sessions as never,
      users as never,
      sessionCookie as never,
    );
    const request = {
      cookies: { familysync_session: "token" },
      user: {
        id: "1",
        plexUserId: "plex",
        plexUsername: "Alex",
        plexToken: "secret",
        enabled: true,
        isAdmin: true,
        isManaged: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    expect(controller.me(request as never)).not.toHaveProperty("plexToken");
    await expect(
      controller.logout(request as never, response as never),
    ).resolves.toEqual({ loggedOut: true });
    await expect(
      controller.unlinkSelf(request as never, response as never),
    ).resolves.toEqual({ removed: true });
    await expect(
      controller.unlinkSelf({} as never, response as never),
    ).resolves.toEqual({ removed: false });
    expect(users.remove).toHaveBeenCalledWith("1");
    expect(sessionCookie.clear).toHaveBeenCalledTimes(2);
  });
});

describe("UsersController", () => {
  it("lists, imports, updates, and removes safe users", async () => {
    const entity = {
      id: "1",
      plexUserId: "plex",
      plexUsername: "Alex",
      plexToken: "secret",
      enabled: true,
      isAdmin: false,
      isManaged: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const users = {
      list: vi.fn().mockResolvedValue([entity]),
      findLinkedAdminWithAccountToken: vi.fn().mockResolvedValue({
        plexUserId: "admin",
        plexAccountToken: "account-token",
      }),
      upsertFromPlex: vi.fn().mockResolvedValue(entity),
      setEnabled: vi.fn().mockResolvedValue(entity),
      remove: vi.fn(),
    };
    const sessions = { revokeUserSessions: vi.fn() };
    const plex = {
      listManagedHomeUsers: vi.fn().mockResolvedValue([]),
      resolveManagedHomeUser: vi.fn().mockResolvedValue({
        plexUserId: "plex",
        plexUsername: "Alex",
        serverAccessToken: "server",
        accountToken: "account",
        serverClientIdentifier: "server-id",
        serverName: "Home",
      }),
    };
    const controller = new UsersController(
      users as never,
      sessions as never,
      plex as never,
    );

    expect(await controller.list()).not.toHaveProperty("[0].plexToken");
    await controller.managedHomeUsers();
    expect(plex.listManagedHomeUsers).toHaveBeenCalled();
    expect(
      await controller.importManagedHomeUser("plex", " 1234 "),
    ).not.toHaveProperty("plexToken");
    expect(await controller.setEnabled("1", false)).not.toHaveProperty(
      "plexToken",
    );
    await expect(controller.remove("1")).resolves.toEqual({ removed: true });
  });
});

describe("RatingsController", () => {
  it("requires authentication for sensitive media endpoints", () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        RatingsController.prototype.favorites,
      ),
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, RatingsController.prototype.poster),
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        RatingsController.prototype.aggregate,
      ),
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        RatingsController.prototype.carousel,
      ),
    ).toBeUndefined();
  });

  it("delegates rating and override operations", async () => {
    const ratings = {
      listFavorites: vi.fn().mockReturnValue("favorites"),
      listPublicCarousel: vi.fn().mockReturnValue("carousel"),
      listExcludedMedia: vi.fn().mockReturnValue("excluded"),
      getDetails: vi.fn().mockReturnValue("details"),
      setTaggingExcluded: vi.fn(),
      aggregate: vi.fn().mockReturnValue("aggregate"),
    };
    const controller = new RatingsController(
      ratings as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(controller.favorites()).toBe("favorites");
    expect(controller.carousel()).toBe("carousel");
    expect(controller.excluded()).toBe("excluded");
    expect(controller.details("1")).toBe("details");
    await expect(
      controller.override("1", { taggingExcluded: true }),
    ).resolves.toBe("details");
    expect(controller.aggregate("1")).toBe("aggregate");
  });
});

describe("SyncController", () => {
  it("delegates jobs, libraries, syncs, and connection tests", async () => {
    const job = { id: "job" };
    const sync = {
      refreshLibraryData: vi.fn().mockReturnValue("refresh"),
      getJobSettings: vi.fn().mockReturnValue("settings"),
      setJobSettings: vi.fn().mockResolvedValue("updated"),
      listMovieLibraries: vi.fn().mockReturnValue("movies"),
      listTvLibraries: vi.fn().mockReturnValue("tv"),
      setSelectedMovieLibraryKeys: vi.fn().mockReturnValue(["1"]),
      setSelectedTvLibraryKeys: vi.fn().mockReturnValue(["2"]),
      startFullSync: vi.fn().mockReturnValue(job),
      startTagSync: vi.fn().mockReturnValue(job),
      startMetadataSync: vi.fn().mockReturnValue(job),
      startUserSync: vi.fn().mockReturnValue(job),
      getJob: vi.fn().mockReturnValue(job),
    };
    const ratings = { getStats: vi.fn().mockReturnValue("stats") };
    const radarr = { testConnection: vi.fn().mockReturnValue("radarr") };
    const sonarr = { testConnection: vi.fn().mockReturnValue("sonarr") };
    const scheduler = { refresh: vi.fn() };
    const controller = new SyncController(
      sync as never,
      ratings as never,
      radarr as never,
      sonarr as never,
      scheduler as never,
    );

    expect(controller.stats()).toBe("stats");
    expect(controller.refreshStats()).toBe("refresh");
    expect(controller.testRadarr({})).toBe("radarr");
    expect(controller.testSonarr({})).toBe("sonarr");
    expect(controller.jobSettings()).toBe("settings");
    await expect(controller.updateJobSettings({})).resolves.toBe("updated");
    expect(controller.libraries()).toBe("movies");
    expect(controller.tvLibraries()).toBe("tv");
    expect(controller.updateLibraries({ selectedKeys: ["1"] })).toEqual(["1"]);
    expect(controller.updateTvLibraries({ selectedKeys: ["2"] })).toEqual([
      "2",
    ]);
    expect(controller.forceSync()).toBe(job);
    expect(controller.syncTags()).toBe(job);
    expect(controller.syncMetadata()).toBe(job);
    expect(controller.syncUser("1")).toBe(job);
    expect(controller.syncJob("job")).toBe(job);

    sync.getJob.mockReturnValue(undefined);
    expect(() => controller.syncJob("missing")).toThrow(NotFoundException);
  });
});
