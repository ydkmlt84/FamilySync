import { clsx } from "clsx";
import { ArrowRight, Link2, RefreshCw, Star, Users } from "lucide-react";
import type { LinkedUser, PublicCarouselRating } from "../api";
import { Metric } from "./Primitives";

export function LandingHero({
  busy,
  currentUser,
  favoriteIndex,
  favorites,
  onJoin,
  raters,
  ratersLoading,
}: {
  busy: boolean;
  currentUser?: LinkedUser;
  favoriteIndex: number;
  favorites: PublicCarouselRating[];
  onJoin: () => void;
  raters: string[];
  ratersLoading: boolean;
}) {
  return (
    <section className="border-b border-[#263245] bg-[#0f172a]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <FamilyFavoritesCarousel
          busy={busy}
          currentUser={currentUser}
          favoriteIndex={favoriteIndex}
          favorites={favorites}
          onJoin={onJoin}
          raters={raters}
          ratersLoading={ratersLoading}
        />
      </div>
    </section>
  );
}

function FamilyFavoritesCarousel({
  busy,
  currentUser,
  favoriteIndex,
  favorites,
  onJoin,
  raters,
  ratersLoading,
}: {
  busy: boolean;
  currentUser?: LinkedUser;
  favoriteIndex: number;
  favorites: PublicCarouselRating[];
  onJoin: () => void;
  raters: string[];
  ratersLoading: boolean;
}) {
  const favorite = favorites[favoriteIndex];

  if (!favorite) {
    return (
      <div className="rounded-lg border border-[#92400e] bg-[#020617] p-4 shadow-lg shadow-amber-950/20">
        <div className="rounded-md bg-[#111827] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[#f59e0b]/15 p-2 text-[#fbbf24]">
                <Star fill="currentColor" size={20} />
              </div>
              <div>
                <p className="text-base font-semibold">Highly Rated</p>
                <p className="text-sm text-[#94a3b8]">
                  Perfect family favorites will appear here.
                </p>
              </div>
            </div>
            {!currentUser && <PlexJoinButton busy={busy} onJoin={onJoin} />}
          </div>
          <div className="mt-5 rounded-md border border-dashed border-[#334155] px-4 py-8 text-center">
            <div>
              <p className="text-sm font-medium">No perfect ratings yet</p>
              <p className="mt-1 text-xs text-[#94a3b8]">
                Items with a 10.0 family average are featured automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#92400e] bg-[#020617] p-4 shadow-lg shadow-amber-950/20">
      <div className="rounded-md bg-[#111827] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263245] pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#f59e0b]/15 p-2 text-[#fbbf24]">
              <Star fill="currentColor" size={20} />
            </div>
            <div>
              <p className="text-base font-semibold">Highly Rated</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d97706] bg-[#78350f] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#fef3c7]">
              Perfect 10
            </span>
            {!currentUser && <PlexJoinButton busy={busy} onJoin={onJoin} />}
          </div>
        </div>
        <div
          className={clsx(
            "mt-5 grid gap-6 sm:items-center",
            currentUser?.isAdmin
              ? "sm:grid-cols-[180px_minmax(0,1fr)_220px]"
              : "sm:grid-cols-[180px_1fr]",
          )}
        >
          <div className="aspect-2/3 overflow-hidden rounded-md border border-[#263245] bg-[#0f172a]">
            {favorite.posterUrl ? (
              <img
                alt={`${favorite.title ?? "Highly rated media"} poster`}
                className="h-full w-full object-cover"
                src={favorite.posterUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#94a3b8]">
                No poster
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#1e293b] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#cbd5e1]">
                {favorite.mediaType}
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold leading-tight text-[#f8fafc] sm:text-3xl">
              {favorite.title ?? `Plex ratingKey ${favorite.ratingKey}`}
            </p>
            <p className="mt-2 max-w-xl text-sm text-[#94a3b8]">
              {favorite.summary ??
                "Every recorded family rating averages to a perfect score."}
            </p>
            <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
              <Metric label="Ratings counted" value={favorite.count} />
            </div>
          </div>
          {currentUser?.isAdmin && (
            <aside className="self-stretch rounded-md border border-[#263245] bg-[#0f172a] p-4">
              <div className="flex items-center gap-2">
                <Users className="text-[#fbbf24]" size={17} />
                <h3 className="text-sm font-semibold">Rated by</h3>
              </div>
              {ratersLoading ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#94a3b8]">
                  <RefreshCw className="animate-spin" size={14} />
                  Loading
                </p>
              ) : raters.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-[#cbd5e1]">
                  {raters.map((name) => (
                    <li className="rounded bg-[#172033] px-3 py-2" key={name}>
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#94a3b8]">
                  No linked raters found.
                </p>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function PlexJoinButton({
  busy,
  onJoin,
}: {
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#0ea5e9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
      disabled={busy}
      onClick={onJoin}
    >
      {busy ? (
        <RefreshCw className="animate-spin" size={17} />
      ) : (
        <Link2 size={17} />
      )}
      {busy ? "Connecting" : "Continue with Plex"}
      <ArrowRight size={16} />
    </button>
  );
}
