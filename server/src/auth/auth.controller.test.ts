import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "./auth.controller";

function makeController({
  needsFirstAdmin = false,
  resolved,
}: {
  needsFirstAdmin?: boolean;
  resolved?: object;
} = {}) {
  const plex = {
    createPin: vi.fn().mockReturnValue({ pinId: 1 }),
    pollPin: vi.fn().mockResolvedValue(resolved),
  };
  const users = {
    upsertFromPlex: vi.fn().mockImplementation(async (value) => ({
      id: "user-id",
      enabled: true,
      isManaged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...value,
    })),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-07-01T00:00:00Z"),
    }),
  };
  const setup = {
    status: vi.fn().mockResolvedValue({
      setupRequired: needsFirstAdmin,
      needsFirstAdmin,
      serverConfigured: false,
    }),
    needsFirstAdmin: vi.fn().mockResolvedValue(needsFirstAdmin),
    listServerCandidates: vi.fn(),
    testServerConnection: vi.fn(),
    saveServerBaseUrl: vi.fn().mockResolvedValue({
      setupRequired: false,
      needsFirstAdmin: false,
      serverConfigured: true,
    }),
  };
  const sessionCookie = {
    set: vi.fn(),
  };
  return {
    controller: new AuthController(
      plex as never,
      users as never,
      sessions as never,
      setup as never,
      sessionCookie as never,
    ),
    plex,
    users,
    sessions,
    setup,
    sessionCookie,
  };
}

describe("AuthController setup protection", () => {
  it("returns the setup status", async () => {
    const { controller } = makeController({ needsFirstAdmin: true });
    await expect(controller.setupStatus()).resolves.toEqual({
      setupRequired: true,
      needsFirstAdmin: true,
      serverConfigured: false,
    });
  });

  it("reports an unresolved PIN as not linked", async () => {
    const { controller } = makeController({ needsFirstAdmin: true });
    await expect(
      controller.pollPin("1", { cookie: vi.fn() } as never),
    ).resolves.toEqual({ linked: false });
  });

  it("rejects a non-owner during initial setup", async () => {
    const { controller, users } = makeController({
      needsFirstAdmin: true,
      resolved: {
        plexUserId: "1",
        plexUsername: "User",
        serverAccessToken: "server-token",
        accountToken: "account-token",
        serverClientIdentifier: "server",
        serverName: "Home",
        isAdmin: false,
      },
    });

    await expect(
      controller.pollPin("1", { cookie: vi.fn() } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.upsertFromPlex).not.toHaveBeenCalled();
  });

  it("links the Plex owner and creates a session without completing setup", async () => {
    const response = { cookie: vi.fn() };
    const { controller, users, sessions, setup, sessionCookie } =
      makeController({
        needsFirstAdmin: true,
        resolved: {
          plexUserId: "1",
          plexUsername: "Owner",
          serverAccessToken: "server-token",
          accountToken: "account-token",
          serverClientIdentifier: "server",
          serverName: "Home",
          isAdmin: true,
        },
      });

    const result = await controller.pollPin("1", response as never);

    expect(result).toMatchObject({
      linked: true,
      user: { plexUsername: "Owner", isAdmin: true },
    });
    expect(result).not.toHaveProperty("user.plexToken");
    expect(users.upsertFromPlex).toHaveBeenCalled();
    expect(sessions.create).toHaveBeenCalled();
    expect(sessionCookie.set).toHaveBeenCalledWith(
      response,
      "session-token",
      new Date("2026-07-01T00:00:00Z"),
    );
    // Completion is deferred to the server-config step.
    expect(setup.saveServerBaseUrl).not.toHaveBeenCalled();
  });

  it("links additional non-owner users once an admin exists", async () => {
    const response = { cookie: vi.fn() };
    const { controller, users } = makeController({
      needsFirstAdmin: false,
      resolved: {
        plexUserId: "2",
        plexUsername: "Family",
        serverAccessToken: "server-token",
        accountToken: "account-token",
        serverClientIdentifier: "server",
        serverName: "Home",
        isAdmin: false,
      },
    });

    const result = await controller.pollPin("1", response as never);

    expect(result).toMatchObject({ linked: true });
    expect(users.upsertFromPlex).toHaveBeenCalled();
  });

  it("saves the chosen Plex base URL", async () => {
    const { controller, setup } = makeController();
    await expect(
      controller.saveServerConfig({ baseUrl: "http://plex:32400/" }),
    ).resolves.toMatchObject({ setupRequired: false });
    expect(setup.saveServerBaseUrl).toHaveBeenCalledWith("http://plex:32400/");
  });
});
