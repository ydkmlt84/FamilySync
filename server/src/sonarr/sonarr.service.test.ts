import { describe, expect, it, vi } from "vitest";
import { SonarrService } from "./sonarr.service";

describe("SonarrService", () => {
  it("preserves a stored API key when an empty key is submitted", async () => {
    const setJson = vi.fn();
    const service = new SonarrService(
      { get: vi.fn() } as never,
      {
        getJson: vi.fn().mockResolvedValue({
          enabled: true,
          url: "http://sonarr:8989",
          apiKey: "stored-secret",
          tagName: "family-favorite",
          removeTagsWhenUnprotected: false,
        }),
        setJson,
      } as never,
    );

    const result = await service.updateSettings({
      enabled: true,
      url: "http://sonarr:8989/",
      apiKey: " ",
      tagName: "updated",
      removeTagsWhenUnprotected: true,
    });

    expect(result.apiKey).toBe("stored-secret");
    expect(result.url).toBe("http://sonarr:8989");
    expect(setJson).toHaveBeenCalledWith(
      "sonarr.settings",
      expect.objectContaining({ apiKey: "stored-secret" }),
    );
  });
});
