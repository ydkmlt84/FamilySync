import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { SESSION_COOKIE_NAME } from "./sessions.service";
import { SessionCookieService } from "./session-cookie.service";

function makeService(values: Record<string, string | undefined>) {
  return new SessionCookieService({
    get: vi.fn((key: string) => values[key]),
  } as never);
}

describe("SessionCookieService", () => {
  it("declares ConfigService explicitly for development runtime injection", () => {
    expect(
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, SessionCookieService),
    ).toEqual([{ index: 0, param: ConfigService }]);
  });

  it("uses strict, HTTP-only cookies for local HTTP development", () => {
    const service = makeService({ publicUrl: "http://localhost:6614" });

    expect(service.options()).toEqual({
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
    });
  });

  it("enables secure cookies automatically for HTTPS", () => {
    const service = makeService({ publicUrl: "https://family.example.com" });

    expect(service.options()).toMatchObject({ secure: true });
  });

  it("honors explicit secure-cookie overrides", () => {
    expect(
      makeService({
        publicUrl: "http://localhost:6614",
        cookieSecure: " TRUE ",
      }).options(),
    ).toMatchObject({ secure: true });
    expect(
      makeService({
        publicUrl: "https://family.example.com",
        cookieSecure: "false",
      }).options(),
    ).toMatchObject({ secure: false });
  });

  it("uses matching options when setting and clearing cookies", () => {
    const service = makeService({ publicUrl: "https://family.example.com" });
    const response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };
    const expiresAt = new Date("2026-07-01T00:00:00Z");

    service.set(response as never, "token", expiresAt);
    service.clear(response as never);

    expect(response.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, "token", {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
      expires: expiresAt,
    });
    expect(response.clearCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
    });
  });
});
