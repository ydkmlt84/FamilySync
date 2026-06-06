import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ExcludedMediaModal,
  filterMediaByType,
  formatSyncStatus,
  IntegrationSettingsCard,
  LogoMark,
  MediaTypeBadge,
  PosterGrid,
  supportsTagExclusion,
} from "./App";
import type { FavoriteMovieRating, IntegrationSettings } from "./api";

const settings: IntegrationSettings = {
  enabled: true,
  url: "http://radarr:7878",
  apiKeyConfigured: true,
  tagName: "family-favorite",
  removeTagsWhenUnprotected: false,
};

describe("IntegrationSettingsCard", () => {
  it("shows configured keys without exposing their value", () => {
    render(
      <IntegrationSettingsCard
        label="Radarr"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        settings={settings}
      />,
    );

    const input = screen.getByLabelText("API key");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute(
      "placeholder",
      "Configured (leave blank to keep)",
    );
  });

  it("disables actions and shows feedback while testing", () => {
    render(
      <IntegrationSettingsCard
        label="Radarr"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onTest={vi.fn()}
        pendingAction="test"
        settings={settings}
      />,
    );

    expect(screen.getByRole("button", { name: "Testing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("calls the selected action", async () => {
    const onTest = vi.fn();
    render(
      <IntegrationSettingsCard
        label="Radarr"
        onChange={vi.fn()}
        onSave={vi.fn()}
        onTest={onTest}
        settings={settings}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(onTest).toHaveBeenCalledOnce();
  });
});

describe("filterMediaByType", () => {
  const media = [
    { ratingKey: "1", mediaType: "movie" },
    { ratingKey: "2", mediaType: "show" },
  ] as FavoriteMovieRating[];

  it("returns every entry for the all filter", () => {
    expect(filterMediaByType(media, "all")).toEqual(media);
  });

  it("returns only the requested media type", () => {
    expect(filterMediaByType(media, "show")).toEqual([media[1]]);
  });
});

describe("TV media posters", () => {
  const media = {
    ratingKey: "episode-1",
    mediaType: "episode",
    title: "Pilot",
    posterUrl: "/api/media/episode-1/poster",
    highest: 9,
    average: 9,
    count: 1,
    protected: true,
    taggingExcluded: false,
    lowRated: false,
    updatedAt: "2026-01-01T00:00:00Z",
  } satisfies FavoriteMovieRating;

  it("labels seasons and episodes but not movies", () => {
    const { rerender } = render(<MediaTypeBadge mediaType="season" />);
    expect(screen.getByText("season")).toBeInTheDocument();

    rerender(<MediaTypeBadge mediaType="episode" />);
    expect(screen.getByText("episode")).toBeInTheDocument();

    rerender(<MediaTypeBadge mediaType="movie" />);
    expect(screen.queryByText("episode")).not.toBeInTheDocument();
  });

  it("renders an episode poster with its media badge", () => {
    render(
      <PosterGrid
        mediaFilter="all"
        movies={[{ ...media, taggingExcluded: true }]}
        onFilterChange={vi.fn()}
        onMovieClick={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Pilot poster" })).toHaveAttribute(
      "src",
      media.posterUrl,
    );
    expect(screen.getByText("episode")).toBeInTheDocument();
    expect(screen.queryByText("Excluded")).not.toBeInTheDocument();
  });

  it("only allows movies and shows to be excluded from tag sync", () => {
    expect(supportsTagExclusion("movie")).toBe(true);
    expect(supportsTagExclusion("show")).toBe(true);
    expect(supportsTagExclusion("season")).toBe(false);
    expect(supportsTagExclusion("episode")).toBe(false);
  });
});

describe("LogoMark", () => {
  it("navigates home when activated", async () => {
    const onClick = vi.fn();
    render(<LogoMark onClick={onClick} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Go to home page" }),
    );

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("formatSyncStatus", () => {
  it("uses user-facing rating and error language", () => {
    expect(formatSyncStatus("rated")).toBe("Rated");
    expect(formatSyncStatus("unrated")).toBe("Not rated");
    expect(formatSyncStatus("error")).toBe("Sync error");
  });
});

describe("ExcludedMediaModal", () => {
  const excludedMovie = {
    ratingKey: "1",
    mediaType: "movie",
    title: "Excluded Movie",
    posterUrl: null,
    highest: 8,
    average: 8,
    count: 1,
    protected: true,
    taggingExcluded: true,
    lowRated: false,
    updatedAt: "2026-01-01T00:00:00Z",
  } satisfies FavoriteMovieRating;

  it("shows the empty state", () => {
    render(
      <ExcludedMediaModal
        mediaFilter="all"
        movies={[]}
        onClose={vi.fn()}
        onFilterChange={vi.fn()}
        onMovieClick={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
      />,
    );

    expect(
      screen.getByText("No media is excluded from tag sync."),
    ).toBeInTheDocument();
  });

  it("refreshes and opens excluded media", async () => {
    const onMovieClick = vi.fn();
    const onRefresh = vi.fn();
    render(
      <ExcludedMediaModal
        mediaFilter="all"
        movies={[excludedMovie]}
        onClose={vi.fn()}
        onFilterChange={vi.fn()}
        onMovieClick={onMovieClick}
        onRefresh={onRefresh}
        refreshing={false}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Refresh excluded items" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "View" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onMovieClick).toHaveBeenCalledWith(excludedMovie);
  });

  it("shows a filter-specific empty state", () => {
    render(
      <ExcludedMediaModal
        mediaFilter="show"
        movies={[excludedMovie]}
        onClose={vi.fn()}
        onFilterChange={vi.fn()}
        onMovieClick={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
      />,
    );

    expect(
      screen.getByText("No excluded media matches this filter."),
    ).toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    const onClose = vi.fn();
    render(
      <ExcludedMediaModal
        mediaFilter="all"
        movies={[]}
        onClose={onClose}
        onFilterChange={vi.fn()}
        onMovieClick={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
