import { clsx } from "clsx";
import { RefreshCw, Search, Shield } from "lucide-react";
import type {
  AggregatedRating,
  MediaSearchResult,
  SyncJobStatus,
  SyncStats,
} from "../api";
import { Metric, SyncActionButton, SyncProgress } from "./Primitives";

export function SyncPanel({
  activeJob,
  onMetadataSync,
  onRatingSync,
  onTagSync,
  syncing,
}: {
  activeJob?: SyncJobStatus;
  onMetadataSync: () => void;
  onRatingSync: () => void;
  onTagSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">Sync</h2>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SyncActionButton
          color="blue"
          label="Ratings"
          onClick={onRatingSync}
          pending={syncing && activeJob?.scope === "full"}
          running={syncing}
        />
        <SyncActionButton
          color="teal"
          label="Tags"
          onClick={onTagSync}
          pending={syncing && activeJob?.scope === "tags"}
          running={syncing}
        />
        <SyncActionButton
          color="purple"
          label="Metadata"
          onClick={onMetadataSync}
          pending={syncing && activeJob?.scope === "metadata"}
          running={syncing}
        />
      </div>
      {syncing && <SyncProgress job={activeJob} />}
    </div>
  );
}

export function RatingLookupCard({
  loadingRating,
  onChange,
  onSelect,
  query,
  rating,
  results,
  searching,
}: {
  loadingRating: boolean;
  onChange: (query: string) => void;
  onSelect: (result: MediaSearchResult) => void;
  query: string;
  rating?: AggregatedRating;
  results: MediaSearchResult[];
  searching: boolean;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Search size={18} />
        <h2 className="text-base font-semibold">Media Search</h2>
      </div>
      <div className="relative mt-4">
        <input
          autoComplete="off"
          className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 pr-10 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search cached media by title"
          value={query}
        />
        {(searching || loadingRating) && (
          <RefreshCw
            className="absolute right-3 top-2.5 animate-spin text-[#94a3b8]"
            size={17}
          />
        )}
        {results.length > 0 && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-[#334155] bg-[#0f172a] shadow-xl">
            {results.map((result) => (
              <button
                className="flex w-full items-center justify-between gap-3 border-b border-[#263245] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[#1f2937]"
                key={result.ratingKey}
                onClick={() => onSelect(result)}
                type="button"
              >
                <span className="min-w-0 truncate font-medium">
                  {result.title}
                  {result.year ? ` (${result.year})` : ""}
                </span>
                <span className="shrink-0 text-xs capitalize text-[#94a3b8]">
                  {result.mediaType}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim().length >= 2 &&
        !searching &&
        !loadingRating &&
        results.length === 0 &&
        !rating && (
          <p className="mt-2 text-xs text-[#94a3b8]">
            No cached media matches this title.
          </p>
        )}
      {rating && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Highest" value={rating.highest ?? "-"} />
            <Metric label="Average" value={rating.average?.toFixed(1) ?? "-"} />
            <Metric label="Count" value={rating.count} />
            <Metric label="Protected" value={rating.protected ? "Yes" : "No"} />
          </div>
          <div className="divide-y divide-[#263245]">
            {rating.ratings.map((entry) => (
              <div className="flex justify-between py-2" key={entry.plexUserId}>
                <span>{entry.user}</span>
                <span className="font-medium">{entry.rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LibraryDataCard({
  onRefresh,
  refreshing,
  stats,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  stats?: SyncStats;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">Library Data</h2>
        <button
          className="ml-auto rounded-md p-2 hover:bg-[#1f2937]"
          disabled={refreshing}
          onClick={onRefresh}
          title="Refresh library data"
        >
          <RefreshCw className={clsx(refreshing && "animate-spin")} size={16} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Movies" value={stats?.cachedMovies ?? "-"} />
        <Metric label="Shows" value={stats?.cachedShows ?? "-"} />
        <Metric label="Seasons" value={stats?.cachedSeasons ?? "-"} />
        <Metric label="Episodes" value={stats?.cachedEpisodes ?? "-"} />
        <Metric label="Rated" value={stats?.ratedMedia ?? "-"} />
        <Metric label="Unrated" value={stats?.unratedMedia ?? "-"} />
        <Metric label="Excluded" value={stats?.excludedMedia ?? "-"} />
        <Metric label="User-Media Rows" value={stats?.cachedEntries ?? "-"} />
      </div>
      <p className="mt-3 text-xs text-[#94a3b8]">
        Rows are per linked user per cached Plex media item.
      </p>
      <p className="mt-3 text-xs text-[#94a3b8]">
        Last updated{" "}
        {stats?.lastUpdatedAt
          ? new Date(stats.lastUpdatedAt).toLocaleString()
          : "never"}
      </p>
    </div>
  );
}

export function LoggingCard({
  logLevel,
  onChange,
}: {
  logLevel: "info" | "debug";
  onChange: (value: "info" | "debug") => void;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">Logging</h2>
      </div>
      <label className="mt-4 block text-sm">
        <span className="text-[#94a3b8]">Log level</span>
        <select
          className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
          onChange={(event) => onChange(event.target.value as "info" | "debug")}
          value={logLevel}
        >
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </label>
      <p className="mt-3 text-xs text-[#94a3b8]">
        Debug logs include per-item sync skips and tag decisions.
      </p>
    </div>
  );
}
