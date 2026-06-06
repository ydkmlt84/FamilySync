import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appConfig } from "./app.config";

describe("appConfig", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("derives data paths from CONFIG_DIR and reads the encryption keys", () => {
    process.env.CONFIG_DIR = "custom-data";
    process.env.APP_ENCRYPTION_KEY = "primary-key";
    process.env.APP_ENCRYPTION_KEY_PREVIOUS = "previous-key";
    process.env.PUBLIC_URL = "https://family.example.com";
    process.env.COOKIE_SECURE = "true";
    process.env.TRUST_PROXY = "true";

    const config = appConfig();

    expect(config.configDir).toBe("custom-data");
    expect(config.databasePath).toBe(join("custom-data", "familysync.sqlite"));
    expect(config.logPath).toBe(join("custom-data", "logs", "familysync.log"));
    expect(config.encryptionKey).toBe("primary-key");
    expect(config.previousEncryptionKey).toBe("previous-key");
    expect(config.publicUrl).toBe("https://family.example.com");
    expect(config.cookieSecure).toBe("true");
    expect(config.trustProxy).toBe("true");
  });

  it("defaults the data directory to ./data", () => {
    delete process.env.CONFIG_DIR;

    const config = appConfig();

    expect(config.configDir).toBe("data");
    expect(config.databasePath).toBe(join("data", "familysync.sqlite"));
  });
});
