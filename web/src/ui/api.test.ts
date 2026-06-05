import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("setup API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads setup status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ setupRequired: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getSetupStatus()).resolves.toEqual({
      setupRequired: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/setup",
      expect.any(Object),
    );
  });

  it("sends the setup token only in the polling header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ linked: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.pollPin(123, "setup-secret");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/pin/123",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Setup-Token": "setup-secret",
        }),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      '"body":"setup-secret"',
    );
  });
});
