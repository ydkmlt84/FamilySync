import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Response } from "express";
import { SESSION_COOKIE_NAME } from "./sessions.service";

@Injectable()
export class SessionCookieService {
  constructor(private readonly config: ConfigService) {}

  set(response: Response, token: string, expiresAt: Date): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.options(),
      expires: expiresAt,
    });
  }

  clear(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.options());
  }

  options(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: "strict",
      secure: this.isSecure(),
      path: "/",
    };
  }

  private isSecure(): boolean {
    const override = this.config.get<string>("cookieSecure");

    if (override !== undefined) {
      return override.trim().toLowerCase() === "true";
    }

    const publicUrl = this.config.get<string>("publicUrl");

    if (!publicUrl) {
      return false;
    }

    try {
      return new URL(publicUrl).protocol === "https:";
    } catch {
      return false;
    }
  }
}
