import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("setup API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads setup status", async () => {
    const status = {
      setupRequired: true,
      needsFirstAdmin: true,
      serverConfigured: false,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(status),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getSetupStatus()).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/setup",
      expect.any(Object),
    );
  });

  it("polls a PIN without sending a setup token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ linked: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.pollPin(123);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/pin/123",
      expect.any(Object),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("Setup-Token");
  });

  it("lists server candidates", async () => {
    const candidates = {
      serverName: "Home",
      clientIdentifier: "abc",
      currentBaseUrl: undefined,
      candidates: [{ uri: "http://plex:32400", local: true }],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(candidates),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getServerCandidates()).resolves.toEqual(candidates);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/server-candidates",
      expect.any(Object),
    );
  });

  it("tests a server connection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, serverName: "Home" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.testServerConnection("http://plex:32400"),
    ).resolves.toEqual({ ok: true, serverName: "Home" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/test-connection",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ uri: "http://plex:32400" }),
      }),
    );
  });

  it("saves the server config", async () => {
    const status = {
      setupRequired: false,
      needsFirstAdmin: false,
      serverConfigured: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(status),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.saveServerConfig("http://plex:32400")).resolves.toEqual(
      status,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/plex/server-config",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ baseUrl: "http://plex:32400" }),
      }),
    );
  });

  it("loads admin carousel rater names", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ names: ["Alex"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getCarouselRaters("123")).resolves.toEqual({
      names: ["Alex"],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/media/carousel/123/raters",
      expect.any(Object),
    );
  });

  it("searches cached media by encoded title", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api.searchMedia("Movie & Show");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/media/search?query=Movie%20%26%20Show",
      expect.any(Object),
    );
  });
});
