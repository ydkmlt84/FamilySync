import { ConsoleLogger, type LoggerService } from "@nestjs/common";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

const SECRET_KEY_PATTERN =
  /token|api[-_]?key|authorization|cookie|password|secret|pin/i;

export class FileLogger implements LoggerService {
  private readonly console = new ConsoleLogger();

  constructor(
    private readonly logPath: string,
    private readonly maxBytes = 5 * 1024 * 1024,
    private readonly retainedFiles = 5,
  ) {
    mkdirSync(dirname(logPath), { recursive: true });
  }

  log(message: unknown, context?: string): void {
    this.write("LOG", message, context);
    this.console.log(this.sanitize(message), context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write("ERROR", message, context, trace);
    this.console.error(
      this.sanitize(message),
      trace ? this.sanitize(trace) : undefined,
      context,
    );
  }

  warn(message: unknown, context?: string): void {
    this.write("WARN", message, context);
    this.console.warn(this.sanitize(message), context);
  }

  debug(message: unknown, context?: string): void {
    this.write("DEBUG", message, context);
    this.console.debug(this.sanitize(message), context);
  }

  verbose(message: unknown, context?: string): void {
    this.write("VERBOSE", message, context);
    this.console.verbose(this.sanitize(message), context);
  }

  fatal(message: unknown, context?: string): void {
    this.write("FATAL", message, context);
    this.console.fatal(this.sanitize(message), context);
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const detail = [this.sanitize(message), trace && this.sanitize(trace)]
      .filter(Boolean)
      .join("\n");
    const line = `${new Date().toISOString()} ${level}${
      context ? ` [${context}]` : ""
    } ${detail}\n`;

    try {
      this.rotateIfNeeded(Buffer.byteLength(line));
      appendFileSync(this.logPath, line, "utf8");
    } catch (error) {
      this.console.error(
        `Unable to write FamilySync log file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        undefined,
        FileLogger.name,
      );
    }
  }

  private sanitize(value: unknown): string {
    if (value instanceof Error) {
      return [value.name, value.message, value.stack]
        .filter(Boolean)
        .map((part) => this.sanitize(String(part)))
        .join("\n");
    }

    if (typeof value === "string") {
      return value
        .replace(
          /([?&](?:X-Plex-Token|apiKey|token)=)[^&\s]+/gi,
          "$1[REDACTED]",
        )
        .replace(
          /("(?:[^"]*(?:token|apiKey|password|secret|cookie|pin)[^"]*)"\s*:\s*)"[^"]*"/gi,
          '$1"[REDACTED]"',
        )
        .replace(
          /\b((?:SETUP_TOKEN|APP_ENCRYPTION_KEY(?:_PREVIOUS)?|PLEX_TOKEN|RADARR_API_KEY|SONARR_API_KEY|SESSION_TOKEN)\s*[:=]\s*)\S+/gi,
          "$1[REDACTED]",
        )
        .replace(
          /\b((?:apiKey|plexToken|plexAccountToken|setupToken|sessionToken|password|secret)\s*[:=]\s*)\S+/gi,
          "$1[REDACTED]",
        )
        .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
    }

    try {
      return JSON.stringify(value, (key, item) =>
        SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : item,
      );
    } catch {
      return String(value);
    }
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (
      !existsSync(this.logPath) ||
      statSync(this.logPath).size + incomingBytes <= this.maxBytes
    ) {
      return;
    }

    const oldestPath = `${this.logPath}.${this.retainedFiles}`;
    if (existsSync(oldestPath)) {
      unlinkSync(oldestPath);
    }

    for (let index = this.retainedFiles - 1; index >= 1; index -= 1) {
      const source = `${this.logPath}.${index}`;
      if (existsSync(source)) {
        renameSync(source, `${this.logPath}.${index + 1}`);
      }
    }

    renameSync(this.logPath, `${this.logPath}.1`);
  }
}
