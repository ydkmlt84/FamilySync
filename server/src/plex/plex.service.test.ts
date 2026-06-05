import { describe, expect, it } from "vitest";
import { selectPlexPosterPath } from "./plex.service";

describe("selectPlexPosterPath", () => {
  it("prefers the season poster for episodes", () => {
    expect(
      selectPlexPosterPath({
        type: "episode",
        thumb: "/episode-still.jpg",
        parentThumb: "/season-poster.jpg",
        grandparentThumb: "/show-poster.jpg",
      }),
    ).toBe("/season-poster.jpg");
  });

  it("falls back to the show poster and episode thumbnail", () => {
    expect(
      selectPlexPosterPath({
        type: "episode",
        thumb: "/episode-still.jpg",
        grandparentThumb: "/show-poster.jpg",
      }),
    ).toBe("/show-poster.jpg");
    expect(
      selectPlexPosterPath({
        type: "episode",
        thumb: "/episode-still.jpg",
      }),
    ).toBe("/episode-still.jpg");
  });

  it("keeps a season or title's own poster when available", () => {
    expect(
      selectPlexPosterPath({
        type: "season",
        thumb: "/season-poster.jpg",
        grandparentThumb: "/show-poster.jpg",
      }),
    ).toBe("/season-poster.jpg");
  });
});
