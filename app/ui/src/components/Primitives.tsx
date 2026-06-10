import { useState } from "react";
import { clsx } from "clsx";
import { Link2, LogOut, RefreshCw, Shield, UserCircle } from "lucide-react";
import type { LinkedUser, SyncJobStatus } from "../api";

export function Badge({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={clsx(
        "rounded px-2 py-0.5 text-xs font-medium",
        muted
          ? "bg-[#1f2937] text-[#94a3b8]"
          : "bg-[#0e7490]/30 text-[#67e8f9]",
      )}
    >
      {label}
    </span>
  );
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md bg-[#172033] px-3 py-2">
      <p className="text-xs text-[#94a3b8]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function LogoMark({ onClick }: { onClick: () => void }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (!logoFailed) {
    return (
      <button
        aria-label="Go to home page"
        className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38bdf8]"
        onClick={onClick}
        type="button"
      >
        <img
          alt=""
          className="h-28 w-28 rounded-md object-contain"
          onError={() => setLogoFailed(true)}
          src="/assets/logo.png"
        />
      </button>
    );
  }

  return (
    <button
      aria-label="Go to home page"
      className="flex h-28 w-28 items-center justify-center rounded-md bg-[#0ea5e9] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38bdf8]"
      onClick={onClick}
      type="button"
    >
      <Link2 size={44} />
    </button>
  );
}

export function UserArea({
  currentUser,
  loggingOut,
  onLogout,
  onSettings,
  settingsActive,
}: {
  currentUser: LinkedUser;
  loggingOut: boolean;
  onLogout: () => void;
  onSettings?: () => void;
  settingsActive: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        {currentUser.plexThumb ? (
          <img
            alt=""
            className="h-8 w-8 rounded-md object-cover"
            src={currentUser.plexThumb}
          />
        ) : (
          <UserCircle className="text-[#94a3b8]" size={28} />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {currentUser.plexUsername}
          </p>
          <p className="text-xs text-[#94a3b8]">
            {currentUser.isAdmin ? "Admin" : "Linked user"}
          </p>
        </div>
      </div>
      {onSettings && (
        <button
          className={clsx(
            "inline-flex min-h-10 items-center gap-2 rounded-md border border-[#334155] px-3 py-2 text-sm font-medium hover:bg-[#1f2937]",
            settingsActive ? "bg-[#1f2937]" : "bg-[#111827]",
          )}
          onClick={onSettings}
          title="Admin settings"
        >
          <Shield size={17} />
          Settings
        </button>
      )}
      <button
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#334155] bg-[#111827] px-3 py-2 text-sm font-medium hover:bg-[#1f2937] disabled:opacity-50"
        disabled={loggingOut}
        onClick={onLogout}
        title="Sign out"
      >
        {loggingOut ? (
          <RefreshCw className="animate-spin" size={17} />
        ) : (
          <LogOut size={17} />
        )}
        {loggingOut ? "Signing Out" : "Sign Out"}
      </button>
    </div>
  );
}

export function SyncActionButton({
  color,
  label,
  onClick,
  pending,
  running,
}: {
  color: "blue" | "teal" | "purple";
  label: string;
  onClick: () => void;
  pending: boolean;
  running: boolean;
}) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-center text-xs font-semibold text-white shadow-sm transition-colors sm:text-sm disabled:cursor-not-allowed disabled:opacity-50",
        color === "blue" && "border-[#38bdf8] bg-[#0ea5e9] hover:bg-[#0284c7]",
        color === "teal" && "border-[#2dd4bf] bg-[#0f766e] hover:bg-[#0d9488]",
        color === "purple" &&
          "border-[#a78bfa] bg-[#7c3aed] hover:bg-[#6d28d9]",
      )}
      disabled={running}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <RefreshCw className={clsx(pending && "animate-spin")} size={17} />
    </button>
  );
}

export function SyncProgress({ job }: { job?: SyncJobStatus }) {
  const total = job?.totalMovies ?? 0;
  const processed = job?.processedMovies ?? 0;
  const percentage =
    total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div className="mt-3 space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-[#172033]">
        <div
          className="h-full rounded-full bg-[#38bdf8] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#94a3b8]">
        <span>{job?.label ?? "Preparing sync"}</span>
        <span>
          {processed} / {total || "-"}
          {job?.cachedSkips ? ` (${job.cachedSkips} recent)` : ""}
        </span>
      </div>
    </div>
  );
}

export function PlexPopupLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1120] text-[#e5e7eb]">
      <div className="rounded-md border border-[#263245] bg-[#111827] px-6 py-5 text-center shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#334155] border-t-[#38bdf8]" />
        <h1 className="text-base font-semibold">Opening Plex</h1>
      </div>
    </main>
  );
}
