import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  backupDatabase,
  isWithinWorkspace,
  parseEnvFile,
  resolveDatabasePath,
} from "./reset-dev-db";

describe("development database reset", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("parses paths without exposing unrelated environment values", () => {
    expect(
      parseEnvFile(
        'CONFIG_DIR="custom-data"\nDATABASE_PATH=\nAPP_ENCRYPTION_KEY=secret',
      ),
    ).toEqual({
      CONFIG_DIR: "custom-data",
      DATABASE_PATH: "",
      APP_ENCRYPTION_KEY: "secret",
    });
    expect(
      resolveDatabasePath("C:/workspace", { CONFIG_DIR: "custom-data" }),
    ).toBe(resolve("C:/workspace", "custom-data/familysync.sqlite"));
  });

  it("recognizes paths inside and outside the workspace", () => {
    expect(
      isWithinWorkspace("C:/workspace", "C:/workspace/data/db.sqlite"),
    ).toBe(true);
    expect(isWithinWorkspace("C:/workspace", "C:/other/db.sqlite")).toBe(false);
  });

  it("moves the database and SQLite sidecars into backups", () => {
    const directory = mkdtempSync(join(tmpdir(), "familysync-reset-"));
    directories.push(directory);
    const databasePath = join(directory, "familysync.sqlite");
    writeFileSync(databasePath, "database");
    writeFileSync(`${databasePath}-wal`, "wal");

    const backupPath = backupDatabase(
      databasePath,
      new Date("2026-06-05T12:00:00.000Z"),
    );

    expect(existsSync(databasePath)).toBe(false);
    expect(readFileSync(backupPath, "utf8")).toBe("database");
    expect(readFileSync(`${backupPath}-wal`, "utf8")).toBe("wal");
  });
});
