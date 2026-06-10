import { join } from "node:path";

export const appConfig = () => {
  const configDir = process.env.CONFIG_DIR || "data";

  return {
    configDir,
    databasePath: join(configDir, "familysync.sqlite"),
    logPath: join(configDir, "logs", "familysync.log"),
    encryptionKey: process.env.APP_ENCRYPTION_KEY,
    previousEncryptionKey: process.env.APP_ENCRYPTION_KEY_PREVIOUS,
    publicUrl: process.env.PUBLIC_URL,
    cookieSecure: process.env.COOKIE_SECURE,
    trustProxy: process.env.TRUST_PROXY,
  };
};
