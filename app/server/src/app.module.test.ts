import { pathToRegexp } from "path-to-regexp";
import { describe, expect, it } from "vitest";
import { STATIC_EXCLUDED_ROUTES } from "./app.module";

describe("static application routing", () => {
  it("excludes API routes with Nest 11 compatible wildcard syntax", () => {
    const { regexp } = pathToRegexp(STATIC_EXCLUDED_ROUTES[0]);

    expect(regexp.test("/api/")).toBe(true);
    expect(regexp.test("/api/auth/plex/setup/")).toBe(true);
    expect(regexp.test("/settings/")).toBe(false);
  });
});
