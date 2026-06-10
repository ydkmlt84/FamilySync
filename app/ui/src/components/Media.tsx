import { clsx } from "clsx";
import { RefreshCw, Shield, Star } from "lucide-react";
import type {
  FavoriteMovieRating,
  LinkedUser,
  MovieRatingDetails,
} from "../api";
import type { MediaFilter } from "../types";
import { Badge } from "./Primitives";

export function supportsTagExclusion(
  mediaType: FavoriteMovieRating["mediaType"],
): boolean {
  return mediaType === "movie" || mediaType === "show";
}

export function filterMediaByType(
  movies: FavoriteMovieRating[],
  filter: MediaFilter,
) {
  return filter === "all"
    ? movies
    : movies.filter((movie) => movie.mediaType === filter);
}

export function MediaTypeBadge({
  mediaType,
}: {
  mediaType: FavoriteMovieRating["mediaType"];
}) {
  if (mediaType !== "season" && mediaType !== "episode") {
    return null;
  }

  return (
    <span
      className={clsx(
        "rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm",
        mediaType === "season"
          ? "border-[#7c3aed] bg-[#4c1d95]/90 text-[#ede9fe]"
          : "border-[#ea580c] bg-[#7c2d12]/90 text-[#ffedd5]",
      )}
    >
      {mediaType}
    </span>
  );
}

export function PosterGrid({
  loadingMovieKey,
  mediaFilter,
  movies,
  onFilterChange,
  onMovieClick,
  onShowExcluded,
}: {
  loadingMovieKey?: string;
  mediaFilter: MediaFilter;
  movies: FavoriteMovieRating[];
  onFilterChange: (filter: MediaFilter) => void;
  onMovieClick: (movie: FavoriteMovieRating) => void;
  onShowExcluded?: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-6">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {onShowExcluded && (
          <button
            className="rounded-md border border-[#b45309] bg-[#78350f] px-3 py-2 text-sm font-medium text-[#fef3c7] hover:bg-[#92400e]"
            onClick={onShowExcluded}
            type="button"
          >
            Show Excluded
          </button>
        )}
        <MediaTypeFilter onChange={onFilterChange} value={mediaFilter} />
      </div>
      {movies.length === 0 ? (
        <div className="rounded-md border border-[#263245] bg-[#111827] p-5 text-sm text-[#94a3b8]">
          No rated media is cached yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {movies.map((movie) => (
            <button
              className="group text-left disabled:animate-pulse disabled:opacity-60"
              disabled={loadingMovieKey === movie.ratingKey}
              key={movie.ratingKey}
              onClick={() => onMovieClick(movie)}
            >
              <div className="relative aspect-2/3 overflow-hidden rounded-md border border-[#263245] bg-[#111827]">
                {movie.posterUrl ? (
                  <img
                    alt={`${movie.title ?? `Plex ${movie.ratingKey}`} poster`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    src={movie.posterUrl}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-sm text-[#94a3b8]">
                    {movie.title ?? `Plex ${movie.ratingKey}`}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <p className="text-sm font-semibold leading-snug text-white drop-shadow">
                    {movie.title ?? `Plex ${movie.ratingKey}`}
                  </p>
                </div>
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {supportsTagExclusion(movie.mediaType) &&
                    movie.taggingExcluded && <Badge label="Excluded" />}
                  {movie.lowRated && <Badge label="Low" muted />}
                </div>
                <div className="absolute right-2 top-2">
                  <MediaTypeBadge mediaType={movie.mediaType} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StarRating average={movie.average} />
                <span className="text-xs text-[#94a3b8]">{movie.count}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ExcludedMediaModal({
  loadingMovieKey,
  mediaFilter,
  movies,
  onClose,
  onFilterChange,
  onMovieClick,
  onRefresh,
  refreshing,
}: {
  loadingMovieKey?: string;
  mediaFilter: MediaFilter;
  movies: FavoriteMovieRating[];
  onClose: () => void;
  onFilterChange: (filter: MediaFilter) => void;
  onMovieClick: (movie: FavoriteMovieRating) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const filteredMovies = filterMediaByType(movies, mediaFilter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-5xl overflow-hidden rounded-md border border-[#263245] bg-[#111827] shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="excluded-media-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263245] px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield size={18} />
            <h2 className="text-base font-semibold" id="excluded-media-title">
              Excluded Items
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <MediaTypeFilter
              compact
              onChange={onFilterChange}
              value={mediaFilter}
            />
            <button
              className="rounded-md p-2 hover:bg-[#1f2937] disabled:opacity-50"
              disabled={refreshing}
              onClick={onRefresh}
              title="Refresh excluded items"
              type="button"
            >
              <RefreshCw
                className={clsx(refreshing && "animate-spin")}
                size={17}
              />
            </button>
            <button
              className="rounded-md border border-[#334155] px-3 py-1.5 text-sm hover:bg-[#1f2937]"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          {movies.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#94a3b8]">
              No media is excluded from tag sync.
            </p>
          ) : filteredMovies.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#94a3b8]">
              No excluded media matches this filter.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[#111827] text-left text-[#94a3b8]">
                <tr className="border-b border-[#263245]">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Average</th>
                  <th className="px-4 py-3 font-medium">Ratings</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovies.map((movie) => (
                  <tr
                    className="border-b border-[#263245]"
                    key={movie.ratingKey}
                  >
                    <td className="px-4 py-3 font-medium">
                      {movie.title ?? `Plex ${movie.ratingKey}`}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#94a3b8]">
                      {movie.mediaType}
                    </td>
                    <td className="px-4 py-3">
                      {movie.average?.toFixed(1) ?? "-"}
                    </td>
                    <td className="px-4 py-3">{movie.count}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-md border border-[#334155] px-3 py-1.5 hover:bg-[#1f2937] disabled:opacity-50"
                        disabled={loadingMovieKey === movie.ratingKey}
                        onClick={() => onMovieClick(movie)}
                        type="button"
                      >
                        {loadingMovieKey === movie.ratingKey
                          ? "Loading"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function RatingsModal({
  currentUser,
  movie,
  onClose,
  onSetTaggingExcluded,
}: {
  currentUser?: LinkedUser;
  movie: MovieRatingDetails;
  onClose: () => void;
  onSetTaggingExcluded: (excluded: boolean) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-hidden rounded-md border border-[#263245] bg-[#111827] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#263245] p-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">
              {movie.title ?? `Plex ${movie.ratingKey}`}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <MediaTypeBadge mediaType={movie.mediaType} />
              {supportsTagExclusion(movie.mediaType) &&
                movie.taggingExcluded && <Badge label="Excluded from tags" />}
              {movie.lowRated && <Badge label="Low-rated" muted />}
            </div>
            <p className="text-sm text-[#94a3b8]">
              {movie.mediaType} - Highest {movie.highest ?? "-"} - Average{" "}
              {movie.average?.toFixed(1) ?? "-"} - {movie.count} ratings
            </p>
          </div>
          <button
            className="rounded-md border border-[#334155] px-3 py-1 text-sm hover:bg-[#1f2937]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="overflow-auto p-4">
          {currentUser?.isAdmin && supportsTagExclusion(movie.mediaType) && (
            <label className="mb-4 flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">Exclude from tag sync</span>
                <span className="text-xs text-[#94a3b8]">
                  Ratings remain visible, but Radarr/Sonarr tags are skipped.
                </span>
              </span>
              <input
                checked={movie.taggingExcluded}
                className="h-4 w-4 accent-[#38bdf8]"
                onChange={(event) => onSetTaggingExcluded(event.target.checked)}
                type="checkbox"
              />
            </label>
          )}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#263245] text-left text-[#94a3b8]">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Rating</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {movie.ratings.map((rating) => (
                <tr
                  className="border-b border-[#263245]"
                  key={rating.plexUserId}
                >
                  <td className="py-2 pr-3">{rating.user}</td>
                  <td className="py-2 pr-3 font-medium">
                    {rating.rating ?? "-"}
                  </td>
                  <td className="py-2 pr-3 text-[#94a3b8]">
                    {formatSyncStatus(rating.syncStatus)}
                  </td>
                  <td className="py-2 text-[#94a3b8]">
                    {new Date(rating.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function formatSyncStatus(
  status: MovieRatingDetails["ratings"][number]["syncStatus"],
): string {
  if (status === "rated") {
    return "Rated";
  }

  if (status === "unrated") {
    return "Not rated";
  }

  return "Sync error";
}

function MediaTypeFilter({
  compact = false,
  onChange,
  value,
}: {
  compact?: boolean;
  onChange: (filter: MediaFilter) => void;
  value: MediaFilter;
}) {
  const options: Array<{ label: string; value: MediaFilter }> = [
    { label: "All", value: "all" },
    { label: "Movies", value: "movie" },
    { label: "Shows", value: "show" },
    { label: "Seasons", value: "season" },
    { label: "Episodes", value: "episode" },
  ];

  return (
    <div
      className={clsx(
        "inline-flex max-w-full overflow-x-auto rounded-md border border-[#263245] bg-[#0f172a] p-1",
        compact && "text-xs",
      )}
    >
      {options.map((option) => (
        <button
          className={clsx(
            "whitespace-nowrap rounded px-3 py-1.5 font-medium transition",
            compact ? "text-xs" : "text-sm",
            value === option.value
              ? "bg-[#0ea5e9] text-white"
              : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e5e7eb]",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StarRating({ average }: { average: number | null }) {
  const stars = average === null ? 0 : average / 2;

  return (
    <div
      aria-label={
        average === null
          ? "No average rating"
          : `Average rating ${average.toFixed(1)} out of 10`
      }
      className="flex items-center gap-0.5 text-[#facc15]"
      title={
        average === null
          ? "No average rating"
          : `Average ${average.toFixed(1)} / 10`
      }
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span className="relative inline-flex" key={index}>
          <Star className="text-[#334155]" size={15} />
          <span
            className="absolute inset-0 overflow-hidden text-[#facc15]"
            style={{
              width: stars >= index + 1 ? "100%" : stars > index ? "50%" : "0%",
            }}
          >
            <Star className="fill-current" size={15} />
          </span>
        </span>
      ))}
    </div>
  );
}
