import { describe, expect, it } from "vitest";
import { toIntegrationSettingsResponse } from "./integration-settings.dto";

describe("toIntegrationSettingsResponse", () => {
  it("replaces the API key with its configured state", () => {
    const response = toIntegrationSettingsResponse({
      enabled: true,
      url: "http://radarr:7878",
      apiKey: "secret-key",
      tagName: "family-favorite",
      removeTagsWhenUnprotected: false,
    });

    expect(response).toEqual({
      enabled: true,
      url: "http://radarr:7878",
      apiKeyConfigured: true,
      tagName: "family-favorite",
      removeTagsWhenUnprotected: false,
    });
    expect(response).not.toHaveProperty("apiKey");
  });

  it("reports when no API key is configured", () => {
    expect(
      toIntegrationSettingsResponse({
        enabled: false,
        url: "",
        apiKey: "",
        tagName: "family-favorite",
        removeTagsWhenUnprotected: false,
      }).apiKeyConfigured,
    ).toBe(false);
  });
});
