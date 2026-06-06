import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";

export function parseEnvFile(contents: string): Record<string, string> {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

export function resolveDatabasePath(
  workspace: string,
  environment: NodeJS.ProcessEnv,
): string {
  const configured =
    environment.DATABASE_PATH ||
    `${environment.CONFIG_DIR || "data"}/familysync.sqlite`;
  return resolve(workspace, configured);
}

export function isWithinWorkspace(workspace: string, target: string): boolean {
  const pathFromWorkspace = relative(resolve(workspace), resolve(target));
  return (
    pathFromWorkspace === "" ||
    (!pathFromWorkspace.startsWith("..") && !isAbsolute(pathFromWorkspace))
  );
}

export function backupDatabase(databasePath: string, timestamp: Date): string {
  const suffix = timestamp.toISOString().replace(/[:.]/g, "-");
  const backupDirectory = resolve(dirname(databasePath), "backups");
  const backupPath = resolve(
    backupDirectory,
    `${basename(databasePath)}.${suffix}.bak`,
  );
  mkdirSync(backupDirectory, { recursive: true });
  renameSync(databasePath, backupPath);

  for (const sidecar of ["-wal", "-shm"]) {
    const source = `${databasePath}${sidecar}`;
    if (existsSync(source)) {
      renameSync(source, `${backupPath}${sidecar}`);
    }
  }

  return backupPath;
}

async function main(): Promise<void> {
  const workspace = process.cwd();
  const envPath = resolve(workspace, ".env");
  const fileEnvironment = existsSync(envPath)
    ? parseEnvFile(readFileSync(envPath, "utf8"))
    : {};
  const environment = { ...fileEnvironment, ...process.env };
  const databasePath = resolveDatabasePath(workspace, environment);
  const allowOutside = process.argv.includes("--allow-outside-workspace");
  const confirmed = process.argv.includes("--yes");

  if (environment.NODE_ENV === "production") {
    throw new Error("Refusing to reset a database with NODE_ENV=production.");
  }

  if (!allowOutside && !isWithinWorkspace(workspace, databasePath)) {
    throw new Error(
      `Refusing to reset a database outside the workspace: ${databasePath}`,
    );
  }

  if (!existsSync(databasePath)) {
    console.log(`No database exists at ${databasePath}.`);
    console.log("The setup wizard will run on the next server start.");
    return;
  }

  console.log(`Development database: ${databasePath}`);
  console.log("Stop the FamilySync dev server before continuing.");

  if (!confirmed) {
    const prompt = createInterface({ input: stdin, output: stdout });
    const answer = await prompt.question(
      'Type "reset" to move this database to a timestamped backup: ',
    );
    prompt.close();

    if (answer.trim().toLowerCase() !== "reset") {
      console.log("Reset cancelled.");
      return;
    }
  }

  const backupPath = backupDatabase(databasePath, new Date());
  console.log(`Database moved to ${backupPath}`);
  console.log("Start FamilySync again to run the setup wizard.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
