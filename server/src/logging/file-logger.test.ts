import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileLogger } from "./file-logger";

describe("FileLogger", () => {
  const directories: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("writes sanitized logs and rotates by size", () => {
    const directory = mkdtempSync(join(tmpdir(), "familysync-logs-"));
    directories.push(directory);
    const logPath = join(directory, "familysync.log");
    const logger = new FileLogger(logPath, 120, 2);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.log(
      'request {"plexToken":"secret","apiKey":"key"}?X-Plex-Token=query SETUP_TOKEN=setup-secret',
      "Test",
    );
    expect(readFileSync(logPath, "utf8")).not.toMatch(
      /secret|query|"key"|setup-secret/,
    );

    logger.log("x".repeat(100), "Test");
    logger.log("y".repeat(100), "Test");
    expect(readFileSync(`${logPath}.1`, "utf8")).toBeTruthy();
  });
});
