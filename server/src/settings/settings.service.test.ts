import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  it("reads, writes, and parses settings", async () => {
    const repository = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce({ value: "plain" })
        .mockResolvedValueOnce({ value: '{"enabled":true}' })
        .mockResolvedValueOnce({ value: "invalid" })
        .mockResolvedValueOnce(undefined),
      create: vi.fn((value) => value),
      save: vi.fn(),
    };
    const encryption = {
      encrypt: vi.fn((value) => `encrypted:${value}`),
      decrypt: vi.fn((value) =>
        value?.startsWith("encrypted:")
          ? value.slice("encrypted:".length)
          : value,
      ),
    };
    const service = new SettingsService(
      repository as never,
      encryption as never,
    );

    await expect(service.get("key")).resolves.toBe("plain");
    await expect(service.getJson("json", {})).resolves.toEqual({
      enabled: true,
    });
    await expect(
      service.getJson("invalid", { fallback: true }),
    ).resolves.toEqual({ fallback: true });
    await expect(service.getJson("missing", ["fallback"])).resolves.toEqual([
      "fallback",
    ]);

    await service.set("key", "value");
    await service.setJson("json", { enabled: true });
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.create).toHaveBeenCalledWith({
      key: "json",
      value: '{"enabled":true}',
    });
  });

  it("encrypts integration settings at the repository boundary", async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue({
        value: 'encrypted:{"apiKey":"secret"}',
      }),
      create: vi.fn((value) => value),
      save: vi.fn(),
    };
    const encryption = {
      encrypt: vi.fn((value) => `encrypted:${value}`),
      decrypt: vi.fn((value) => value.slice("encrypted:".length)),
    };
    const service = new SettingsService(
      repository as never,
      encryption as never,
    );

    await expect(service.getJson("radarr.settings", {})).resolves.toEqual({
      apiKey: "secret",
    });
    await service.setJson("sonarr.settings", { apiKey: "secret" });
    expect(repository.create).toHaveBeenCalledWith({
      key: "sonarr.settings",
      value: 'encrypted:{"apiKey":"secret"}',
    });
  });
});
