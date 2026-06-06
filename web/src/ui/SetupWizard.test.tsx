import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InitialSyncStep } from "./SetupWizard";
import { api, type SyncJobStatus } from "./api";

describe("InitialSyncStep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("allows setup to finish without running a sync", async () => {
    vi.spyOn(api, "getMovieLibraries").mockResolvedValue({
      libraries: [{ key: "movies", title: "Movies", selected: true }],
      selectedKeys: [],
    });
    vi.spyOn(api, "getTvLibraries").mockResolvedValue({
      libraries: [{ key: "tv", title: "TV", selected: true }],
      selectedKeys: [],
    });
    vi.spyOn(api, "updateMovieLibraries").mockResolvedValue(["movies"]);
    vi.spyOn(api, "updateTvLibraries").mockResolvedValue(["tv"]);
    const onComplete = vi.fn();
    render(<InitialSyncStep onComplete={onComplete} />);

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(api.updateMovieLibraries).toHaveBeenCalledWith(["movies"]);
    expect(api.updateTvLibraries).toHaveBeenCalledWith(["tv"]);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows live sync progress and completes setup", async () => {
    vi.useFakeTimers();
    vi.spyOn(api, "getMovieLibraries").mockResolvedValue({
      libraries: [{ key: "movies", title: "Movies", selected: true }],
      selectedKeys: [],
    });
    vi.spyOn(api, "getTvLibraries").mockResolvedValue({
      libraries: [{ key: "tv", title: "TV", selected: true }],
      selectedKeys: [],
    });
    vi.spyOn(api, "updateMovieLibraries").mockResolvedValue(["movies"]);
    vi.spyOn(api, "updateTvLibraries").mockResolvedValue(["tv"]);
    const running = {
      id: "job-1",
      label: "Full library sync",
      scope: "full",
      status: "running",
      totalMovies: 100,
      processedMovies: 25,
      syncedMovies: 25,
      skippedMovies: 0,
      cachedSkips: 0,
      users: 1,
      startedAt: new Date().toISOString(),
    } satisfies SyncJobStatus;
    const completed = {
      ...running,
      status: "completed",
      processedMovies: 100,
      syncedMovies: 100,
    } satisfies SyncJobStatus;
    vi.spyOn(api, "forceSync").mockResolvedValue(running);
    vi.spyOn(api, "getSyncJob").mockResolvedValue(completed);
    const onComplete = vi.fn();
    render(<InitialSyncStep onComplete={onComplete} />);

    await act(async () => {
      await Promise.resolve();
    });
    screen.getByRole("button", { name: "Run first sync" }).click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("25 / 100")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.getSyncJob).toHaveBeenCalledWith("job-1");
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("saves the exact selected libraries before the first sync", async () => {
    vi.spyOn(api, "getMovieLibraries").mockResolvedValue({
      libraries: [
        { key: "movies", title: "Movies", selected: true },
        { key: "4k", title: "4K Movies", selected: true },
      ],
      selectedKeys: [],
    });
    vi.spyOn(api, "getTvLibraries").mockResolvedValue({
      libraries: [{ key: "tv", title: "TV", selected: true }],
      selectedKeys: [],
    });
    vi.spyOn(api, "updateMovieLibraries").mockResolvedValue(["movies"]);
    vi.spyOn(api, "updateTvLibraries").mockResolvedValue(["tv"]);
    vi.spyOn(api, "forceSync").mockResolvedValue({
      id: "job-1",
      label: "Full library sync",
      scope: "full",
      status: "completed",
      totalMovies: 0,
      processedMovies: 0,
      syncedMovies: 0,
      skippedMovies: 0,
      cachedSkips: 0,
      users: 1,
      startedAt: new Date().toISOString(),
    });
    render(<InitialSyncStep onComplete={vi.fn()} />);

    await screen.findByText("4K Movies");
    await userEvent.click(screen.getByLabelText("4K Movies"));
    await userEvent.click(
      screen.getByRole("button", { name: "Run first sync" }),
    );

    expect(api.updateMovieLibraries).toHaveBeenCalledWith(["movies"]);
    expect(api.updateTvLibraries).toHaveBeenCalledWith(["tv"]);
  });
});
