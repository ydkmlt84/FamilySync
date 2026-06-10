import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SetupService } from "./setup.service";

function makeService({
  admin = null,
  serverConfigured = false,
  completed = false,
}: {
  admin?: object | null;
  serverConfigured?: boolean;
  completed?: boolean;
} = {}) {
  const users = {
    findAdmin: vi.fn().mockResolvedValue(admin),
    findLinkedAdminWithAccountToken: vi.fn().mockResolvedValue(admin),
  };
  const settings = {
    get: vi.fn(async (key: string) => {
      if (key === "setup.completed") {
        return completed ? "true" : undefined;
      }
      if (key === "plex.baseUrl") {
        return serverConfigured ? "http://plex:32400" : undefined;
      }
      return undefined;
    }),
    set: vi.fn(),
  };
  const plex = {
    listServerConnections: vi.fn().mockResolvedValue({ candidates: [] }),
    testServerBaseUrl: vi.fn().mockResolvedValue({ ok: true }),
  };
  return {
    service: new SetupService(users as never, settings as never, plex as never),
    users,
    settings,
    plex,
  };
}

describe("SetupService", () => {
  it("requires setup when no admin exists", async () => {
    const { service } = makeService();
    await expect(service.status()).resolves.toEqual({
      setupRequired: true,
      needsFirstAdmin: true,
      serverConfigured: false,
    });
    await expect(service.needsFirstAdmin()).resolves.toBe(true);
  });

  it("still requires setup when an admin exists but no server is configured", async () => {
    const { service } = makeService({ admin: { id: "admin" } });
    await expect(service.status()).resolves.toEqual({
      setupRequired: true,
      needsFirstAdmin: false,
      serverConfigured: false,
    });
  });

  it("completes setup once an admin and server URL are present", async () => {
    const { service, settings } = makeService({
      admin: { id: "admin" },
      serverConfigured: true,
    });
    await expect(service.status()).resolves.toEqual({
      setupRequired: false,
      needsFirstAdmin: false,
      serverConfigured: true,
    });
    expect(settings.set).toHaveBeenCalledWith("setup.completed", "true");
  });

  it("stays complete once flagged", async () => {
    const { service } = makeService({ completed: true });
    await expect(service.status()).resolves.toMatchObject({
      setupRequired: false,
    });
  });

  it("saves the base URL and marks setup complete", async () => {
    const { service, settings } = makeService({ admin: { id: "admin" } });
    settings.get.mockImplementation(async (key: string) => {
      if (key === "plex.baseUrl") {
        return "http://plex:32400";
      }
      return undefined;
    });

    const status = await service.saveServerBaseUrl("http://plex:32400/");
    expect(settings.set).toHaveBeenCalledWith(
      "plex.baseUrl",
      "http://plex:32400",
    );
    expect(settings.set).toHaveBeenCalledWith("setup.completed", "true");
    expect(status).toMatchObject({ setupRequired: false });
  });

  it("refuses to query Plex candidates without a linked admin", async () => {
    const { service } = makeService();
    await expect(service.listServerCandidates()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("lists server candidates using the admin account token", async () => {
    const { service, plex } = makeService({
      admin: { plexAccountToken: "account-token", plexToken: "server-token" },
    });
    await service.listServerCandidates();
    expect(plex.listServerConnections).toHaveBeenCalledWith("account-token");
  });

  it("tests a connection using the admin server token", async () => {
    const { service, plex } = makeService({
      admin: { plexAccountToken: "account-token", plexToken: "server-token" },
    });
    await service.testServerConnection("http://plex:32400");
    expect(plex.testServerBaseUrl).toHaveBeenCalledWith(
      "http://plex:32400",
      "server-token",
    );
  });
});
