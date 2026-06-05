import { join } from "node:path";

export const appConfig = () => ({
  configDir: process.env.CONFIG_DIR || "data",
  databasePath:
    process.env.DATABASE_PATH ||
    join(process.env.CONFIG_DIR || "data", "familysync.sqlite"),
  logPath:
    process.env.LOG_PATH ||
    join(process.env.CONFIG_DIR || "data", "logs", "familysync.log"),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:5174",
  setupToken: process.env.SETUP_TOKEN,
  encryptionKey: process.env.APP_ENCRYPTION_KEY,
  previousEncryptionKey: process.env.APP_ENCRYPTION_KEY_PREVIOUS,
  plex: {
    baseUrl: (process.env.PLEX_BASE_URL ?? "").replace(/\/+$/, ""),
    serverClientIdentifier: process.env.PLEX_SERVER_IDENTIFIER,
    serverName: process.env.PLEX_SERVER_NAME,
    adminPlexUserId: process.env.PLEX_ADMIN_USER_ID,
    product: "FamilySync",
    clientIdentifier: process.env.PLEX_CLIENT_IDENTIFIER ?? "familysync",
  },
  ratings: {
    protectionThreshold: Number(process.env.PROTECTION_THRESHOLD ?? 7),
  },
  radarr: {
    enabled: process.env.RADARR_ENABLED === "true",
    url: (process.env.RADARR_URL ?? "").replace(/\/+$/, ""),
    apiKey: process.env.RADARR_API_KEY,
    tagName: process.env.RADARR_TAG_NAME ?? "family-favorite",
    protectionThreshold: Number(
      process.env.RADARR_PROTECTION_THRESHOLD ??
        process.env.PROTECTION_THRESHOLD ??
        7,
    ),
    removeTagsWhenUnprotected:
      process.env.RADARR_REMOVE_TAGS_WHEN_UNPROTECTED === "true",
  },
  sonarr: {
    enabled: process.env.SONARR_ENABLED === "true",
    url: (process.env.SONARR_URL ?? "").replace(/\/+$/, ""),
    apiKey: process.env.SONARR_API_KEY,
    tagName: process.env.SONARR_TAG_NAME ?? "family-favorite",
    protectionThreshold: Number(
      process.env.SONARR_PROTECTION_THRESHOLD ??
        process.env.PROTECTION_THRESHOLD ??
        7,
    ),
    removeTagsWhenUnprotected:
      process.env.SONARR_REMOVE_TAGS_WHEN_UNPROTECTED === "true",
  },
});
