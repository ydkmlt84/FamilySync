import { describe, expect, it, vi } from "vitest";
import { SecretMigrationService } from "./secret-migration.service";

describe("SecretMigrationService", () => {
  it("migrates plaintext Plex and integration secrets", async () => {
    const linkedUsers = {
      find: vi.fn().mockResolvedValue([
        {
          id: "1",
          plexToken: "plex-token",
          plexAccountToken: "account-token",
        },
      ]),
      update: vi.fn(),
    };
    const settings = {
      findBy: vi.fn().mockResolvedValue([
        {
          key: "radarr.settings",
          value: '{"apiKey":"radarr-key"}',
        },
      ]),
      update: vi.fn(),
    };
    const encryption = {
      assertConfigured: vi.fn(),
      isEncrypted: vi.fn((value) => value.startsWith("enc:")),
      encrypt: vi.fn((value) => `enc:${value}`),
      decrypt: vi.fn(),
    };
    const service = new SecretMigrationService(
      linkedUsers as never,
      settings as never,
      encryption as never,
    );

    await service.onApplicationBootstrap();
    expect(linkedUsers.update).toHaveBeenCalledWith("1", {
      plexToken: "enc:plex-token",
      plexAccountToken: "enc:account-token",
    });
    expect(settings.update).toHaveBeenCalledWith("radarr.settings", {
      value: 'enc:{"apiKey":"radarr-key"}',
    });
  });

  it("does not require a key when no stored secrets exist", async () => {
    const encryption = { assertConfigured: vi.fn() };
    const service = new SecretMigrationService(
      { find: vi.fn().mockResolvedValue([]) } as never,
      { findBy: vi.fn().mockResolvedValue([]) } as never,
      encryption as never,
    );

    await service.onApplicationBootstrap();
    expect(encryption.assertConfigured).not.toHaveBeenCalled();
  });
});
