import { describe, expect, it, vi } from "vitest";
import { RadarrService } from "./radarr.service";

describe("RadarrService", () => {
  it("preserves a stored API key when an empty key is submitted", async () => {
    const setJson = vi.fn();
    const service = new RadarrService(
      { get: vi.fn() } as never,
      {
        getJson: vi.fn().mockResolvedValue({
          enabled: true,
          url: "http://radarr:7878",
          apiKey: "stored-secret",
          tagName: "family-favorite",
          removeTagsWhenUnprotected: false,
        }),
        setJson,
      } as never,
    );

    const result = await service.updateSettings({
      enabled: true,
      url: "http://radarr:7878/",
      apiKey: "",
      tagName: "updated",
      removeTagsWhenUnprotected: true,
    });

    expect(result.apiKey).toBe("stored-secret");
    expect(result.url).toBe("http://radarr:7878");
    expect(setJson).toHaveBeenCalledWith(
      "radarr.settings",
      expect.objectContaining({ apiKey: "stored-secret" }),
    );
  });
});
