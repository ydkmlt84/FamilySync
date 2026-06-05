import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appConfig } from "./app.config";

describe("appConfig", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("uses defaults and normalizes service URLs", () => {
    process.env.DATABASE_PATH = "";
    process.env.CONFIG_DIR = "custom-data";
    process.env.LOG_PATH = "";
    process.env.PLEX_BASE_URL = "http://plex///";
    process.env.RADARR_URL = "http://radarr/";
    process.env.RADARR_ENABLED = "true";
    process.env.SONARR_REMOVE_TAGS_WHEN_UNPROTECTED = "true";
    process.env.PROTECTION_THRESHOLD = "8";
    process.env.SETUP_TOKEN = "setup-secret";

    const config = appConfig();

    expect(config.plex.baseUrl).toBe("http://plex");
    expect(config.radarr).toMatchObject({
      enabled: true,
      url: "http://radarr",
      protectionThreshold: 8,
    });
    expect(config.sonarr.removeTagsWhenUnprotected).toBe(true);
    expect(config.ratings.protectionThreshold).toBe(8);
    expect(config.setupToken).toBe("setup-secret");
    expect(config.configDir).toBe("custom-data");
    expect(config.databasePath).toBe(join("custom-data", "familysync.sqlite"));
    expect(config.logPath).toBe(join("custom-data", "logs", "familysync.log"));
  });
});
