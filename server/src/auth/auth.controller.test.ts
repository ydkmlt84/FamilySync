import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "./auth.controller";

function makeController({
  initialSetup = false,
  resolved,
}: {
  initialSetup?: boolean;
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
    status: vi.fn().mockResolvedValue({ setupRequired: initialSetup }),
    authorizeInitialSetup: vi.fn().mockResolvedValue(initialSetup),
    completeInitialSetup: vi.fn(),
    releaseInitialSetup: vi.fn(),
  };
  return {
    controller: new AuthController(
      plex as never,
      users as never,
      sessions as never,
      setup as never,
    ),
    plex,
    users,
    sessions,
    setup,
  };
}

describe("AuthController setup protection", () => {
  it("returns setup status and pending PIN state", async () => {
    const { controller, setup } = makeController({ initialSetup: true });
    await expect(controller.setupStatus()).resolves.toEqual({
      setupRequired: true,
    });
    await expect(
      controller.pollPin("1", "a".repeat(32), { cookie: vi.fn() } as never),
    ).resolves.toEqual({ linked: false });
    expect(setup.authorizeInitialSetup).toHaveBeenCalledWith(1, "a".repeat(32));
  });

  it("rejects a non-owner during initial setup", async () => {
    const { controller, setup, users } = makeController({
      initialSetup: true,
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
      controller.pollPin("1", "a".repeat(32), { cookie: vi.fn() } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(setup.releaseInitialSetup).toHaveBeenCalledWith(1);
    expect(users.upsertFromPlex).not.toHaveBeenCalled();
  });

  it("links the Plex owner and creates a session", async () => {
    const response = { cookie: vi.fn() };
    const { controller, users, sessions, setup } = makeController({
      initialSetup: true,
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

    const result = await controller.pollPin(
      "1",
      "a".repeat(32),
      response as never,
    );

    expect(result).toMatchObject({
      linked: true,
      user: { plexUsername: "Owner", isAdmin: true },
    });
    expect(result).not.toHaveProperty("user.plexToken");
    expect(users.upsertFromPlex).toHaveBeenCalled();
    expect(setup.completeInitialSetup).toHaveBeenCalledWith(1);
    expect(sessions.create).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalled();
  });

  it("releases the setup claim when Plex resolution fails", async () => {
    const { controller, plex, setup } = makeController({
      initialSetup: true,
    });
    plex.pollPin.mockRejectedValue(new Error("Plex failed"));

    await expect(
      controller.pollPin("1", "a".repeat(32), { cookie: vi.fn() } as never),
    ).rejects.toThrow("Plex failed");
    expect(setup.releaseInitialSetup).toHaveBeenCalledWith(1);
  });
});
