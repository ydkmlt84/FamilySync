import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  RefreshCw,
  Server,
} from "lucide-react";
import { clsx } from "clsx";
import {
  api,
  LinkedUser,
  MovieLibrarySelection,
  ServerCandidates,
  SyncJobStatus,
} from "./api";

type WizardStep = "welcome" | "admin" | "server" | "sync" | "done";

export function SetupWizard({
  needsFirstAdmin,
  busy,
  currentUser,
  pinCode,
  onJoin,
  onComplete,
}: {
  needsFirstAdmin: boolean;
  busy: boolean;
  currentUser?: LinkedUser;
  pinCode?: string;
  onJoin: () => void;
  onComplete: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<WizardStep>(
    needsFirstAdmin ? "welcome" : "server",
  );

  useEffect(() => {
    if (!needsFirstAdmin && (step === "welcome" || step === "admin")) {
      setStep("server");
    }
  }, [needsFirstAdmin, step]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1120] px-5 py-10 text-[#e5e7eb]">
      <div className="w-full max-w-xl rounded-lg border border-[#263245] bg-[#111827] p-6 shadow-xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#0ea5e9] text-white">
            <Link2 size={26} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">FamilySync setup</h1>
            <p className="text-sm text-[#94a3b8]">
              Let's get your instance connected to Plex.
            </p>
          </div>
        </header>

        <Steps current={step} />

        <div className="mt-6">
          {step === "welcome" && (
            <WelcomeStep onNext={() => setStep("admin")} />
          )}
          {step === "admin" && (
            <AdminStep busy={busy} onJoin={onJoin} pinCode={pinCode} />
          )}
          {step === "server" && (
            <ServerStep
              serverName={currentUser?.plexServerName}
              onComplete={() => setStep("sync")}
            />
          )}
          {step === "sync" && (
            <InitialSyncStep
              onComplete={async () => {
                setStep("done");
                await new Promise((resolve) => window.setTimeout(resolve, 800));
                await onComplete();
              }}
            />
          )}
          {step === "done" && <DoneStep />}
        </div>
      </div>
    </main>
  );
}

function Steps({ current }: { current: WizardStep }) {
  const order: WizardStep[] = ["welcome", "admin", "server", "sync", "done"];
  const labels: Record<WizardStep, string> = {
    welcome: "Welcome",
    admin: "Link Plex",
    server: "Choose server",
    sync: "First sync",
    done: "Done",
  };
  const currentIndex = order.indexOf(current);

  return (
    <ol className="flex items-center gap-2 text-xs">
      {order.map((stepKey, index) => (
        <li className="flex flex-1 items-center gap-2" key={stepKey}>
          <span
            className={clsx(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
              index <= currentIndex
                ? "border-[#0ea5e9] bg-[#0ea5e9] text-white"
                : "border-[#334155] text-[#64748b]",
            )}
          >
            {index + 1}
          </span>
          <span
            className={clsx(
              "truncate",
              index <= currentIndex ? "text-[#e5e7eb]" : "text-[#64748b]",
            )}
          >
            {labels[stepKey]}
          </span>
          {index < order.length - 1 && (
            <span className="hidden h-px flex-1 bg-[#263245] sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#cbd5e1]">
        FamilySync aggregates the movie and show ratings of your linked Plex
        users. To begin, you'll sign in as the{" "}
        <strong>Plex server owner</strong> and then pick how FamilySync should
        reach your Plex Media Server.
      </p>
      <p className="text-sm text-[#94a3b8]">
        Everything else is configured later from the in-app settings.
      </p>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0ea5e9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0284c7]"
        onClick={onNext}
        type="button"
      >
        Get started
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function AdminStep({
  busy,
  onJoin,
  pinCode,
}: {
  busy: boolean;
  onJoin: () => void;
  pinCode?: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#cbd5e1]">
        Sign in with the Plex account that <strong>owns the server</strong> you
        want FamilySync to manage. The first owner to link becomes the admin.
      </p>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0ea5e9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
        disabled={busy}
        onClick={onJoin}
        type="button"
      >
        {busy ? (
          <RefreshCw className="animate-spin" size={18} />
        ) : (
          <Link2 size={18} />
        )}
        {busy ? "Connecting" : "Link with Plex"}
        <ArrowRight size={17} />
      </button>
      {pinCode && (
        <p className="rounded-md border border-[#263245] bg-[#0f172a] px-3 py-2 text-sm text-[#94a3b8]">
          Plex authorization pending for code{" "}
          <span className="font-semibold text-[#e5e7eb]">{pinCode}</span>
        </p>
      )}
    </div>
  );
}

function ServerStep({
  serverName,
  onComplete,
}: {
  serverName?: string;
  onComplete: () => Promise<void> | void;
}) {
  const [data, setData] = useState<ServerCandidates>();
  const [loading, setLoading] = useState(false);
  const [selectedUri, setSelectedUri] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [manualUri, setManualUri] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    serverName?: string;
  }>();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getServerCandidates()
      .then((result) => {
        setData(result);
        const first = result.candidates[0]?.uri ?? result.currentBaseUrl ?? "";
        setSelectedUri(first);
        if (result.candidates.length === 0) {
          setUseManual(true);
          if (result.currentBaseUrl) {
            setManualUri(result.currentBaseUrl);
          }
        }
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setLoading(false));
  }, []);

  const effectiveUri = (useManual ? manualUri : selectedUri).trim();

  async function test() {
    if (!effectiveUri) {
      return;
    }

    setTesting(true);
    setError("");
    setTestResult(undefined);

    try {
      setTestResult(await api.testServerConnection(effectiveUri));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!effectiveUri) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const status = await api.saveServerConfig(effectiveUri);

      if (status.setupRequired) {
        setError("Setup is still incomplete. Check the server URL and retry.");
        return;
      }

      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Server size={18} />
        <span>
          Choose how FamilySync reaches{" "}
          <strong>
            {data?.serverName ?? serverName ?? "your Plex server"}
          </strong>
          .
        </span>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <RefreshCw className="animate-spin" size={16} /> Discovering Plex
          connections…
        </p>
      ) : (
        <>
          {data && data.candidates.length > 0 && !useManual && (
            <div className="space-y-2">
              {data.candidates.map((candidate) => (
                <label
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm hover:bg-[#1f2937]"
                  key={candidate.uri}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {candidate.uri}
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      {candidate.local ? "Local network" : "Remote"}
                    </span>
                  </span>
                  <input
                    checked={selectedUri === candidate.uri}
                    className="h-4 w-4 accent-[#38bdf8]"
                    name="server-uri"
                    onChange={() => {
                      setSelectedUri(candidate.uri);
                      setTestResult(undefined);
                    }}
                    type="radio"
                  />
                </label>
              ))}
            </div>
          )}

          {useManual && (
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Plex server URL</span>
              <input
                autoComplete="off"
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
                onChange={(event) => {
                  setManualUri(event.target.value);
                  setTestResult(undefined);
                }}
                placeholder="http://192.168.1.10:32400"
                value={manualUri}
              />
            </label>
          )}

          {data && data.candidates.length > 0 && (
            <button
              className="text-xs text-[#38bdf8] hover:underline"
              onClick={() => {
                setUseManual((value) => !value);
                setTestResult(undefined);
              }}
              type="button"
            >
              {useManual
                ? "Choose a discovered connection instead"
                : "Enter a URL manually instead"}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-[#334155] px-4 py-2 text-sm hover:bg-[#1f2937] disabled:opacity-50"
              disabled={!effectiveUri || testing}
              onClick={test}
              type="button"
            >
              {testing ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Server size={16} />
              )}
              Test connection
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[#0ea5e9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
              disabled={!effectiveUri || saving}
              onClick={save}
              type="button"
            >
              {saving ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Save &amp; finish
            </button>
          </div>

          {testResult && (
            <p
              className={clsx(
                "rounded-md border px-3 py-2 text-sm",
                testResult.ok
                  ? "border-[#15803d] bg-[#052e16] text-[#bbf7d0]"
                  : "border-[#b91c1c] bg-[#450a0a] text-[#fecaca]",
              )}
            >
              {testResult.ok
                ? `Connected${
                    testResult.serverName ? ` to ${testResult.serverName}` : ""
                  }.`
                : "Could not reach Plex at that URL. Pick another connection or enter one manually."}
            </p>
          )}
        </>
      )}

      {error && (
        <p className="rounded-md border border-[#b91c1c] bg-[#450a0a] px-3 py-2 text-sm text-[#fecaca]">
          {error}
        </p>
      )}
    </div>
  );
}

export function InitialSyncStep({
  onComplete,
}: {
  onComplete: () => Promise<void> | void;
}) {
  const [job, setJob] = useState<SyncJobStatus>();
  const [starting, setStarting] = useState(false);
  const [loadingLibraries, setLoadingLibraries] = useState(true);
  const [movieLibraries, setMovieLibraries] = useState<MovieLibrarySelection>();
  const [tvLibraries, setTvLibraries] = useState<MovieLibrarySelection>();
  const [error, setError] = useState("");
  const total = job?.totalMovies ?? 0;
  const processed = job?.processedMovies ?? 0;
  const percentage =
    total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const selectedMovieKeys =
    movieLibraries?.libraries
      .filter((library) => library.selected)
      .map((library) => library.key) ?? [];
  const selectedTvKeys =
    tvLibraries?.libraries
      .filter((library) => library.selected)
      .map((library) => library.key) ?? [];
  const libraryCount =
    (movieLibraries?.libraries.length ?? 0) +
    (tvLibraries?.libraries.length ?? 0);
  const selectedCount = selectedMovieKeys.length + selectedTvKeys.length;

  useEffect(() => {
    Promise.all([api.getMovieLibraries(), api.getTvLibraries()])
      .then(([movies, tv]) => {
        setMovieLibraries(movies);
        setTvLibraries(tv);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => setLoadingLibraries(false));
  }, []);

  function toggleLibrary(type: "movie" | "tv", key: string): void {
    const update = (current: MovieLibrarySelection | undefined) =>
      current
        ? {
            ...current,
            libraries: current.libraries.map((library) =>
              library.key === key
                ? { ...library, selected: !library.selected }
                : library,
            ),
          }
        : current;

    if (type === "movie") {
      setMovieLibraries(update);
    } else {
      setTvLibraries(update);
    }
  }

  async function saveLibrarySelections(): Promise<void> {
    await Promise.all([
      api.updateMovieLibraries(selectedMovieKeys),
      api.updateTvLibraries(selectedTvKeys),
    ]);
  }

  async function runSync() {
    setStarting(true);
    setError("");

    try {
      await saveLibrarySelections();
      let current = await api.forceSync();
      setJob(current);

      while (current.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        current = await api.getSyncJob(current.id);
        setJob(current);
      }

      if (current.status === "failed") {
        throw new Error(current.error ?? "Initial sync failed.");
      }

      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStarting(false);
    }
  }

  async function skipSync() {
    setStarting(true);
    setError("");

    try {
      await saveLibrarySelections();
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStarting(false);
    }
  }

  if (job?.status === "running") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Building your library</h2>
          <p className="mt-1 text-sm text-[#94a3b8]">
            FamilySync is collecting Plex ratings and metadata. You can leave
            this page open while it works.
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#172033]">
          <div
            className="h-full rounded-full bg-[#38bdf8] transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#94a3b8]">
          <span>{job.label}</span>
          <span>
            {processed} / {total || "-"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">
          Select which libraries' ratings you want to sync
        </h2>
        <p className="mt-1 text-sm text-[#cbd5e1]">
          FamilySync will only collect ratings and metadata from the Plex
          libraries selected below. You can change these later in Settings.
        </p>
      </div>
      {loadingLibraries ? (
        <p className="flex items-center gap-2 text-sm text-[#94a3b8]">
          <RefreshCw className="animate-spin" size={16} />
          Loading Plex libraries...
        </p>
      ) : (
        <div className="grid max-h-72 gap-3 overflow-y-auto sm:grid-cols-2">
          <LibrarySelectionGroup
            label="Movie libraries"
            libraries={movieLibraries}
            onToggle={(key) => toggleLibrary("movie", key)}
          />
          <LibrarySelectionGroup
            label="TV libraries"
            libraries={tvLibraries}
            onToggle={(key) => toggleLibrary("tv", key)}
          />
        </div>
      )}
      <p className="text-xs text-[#94a3b8]">
        {selectedCount} of {libraryCount} libraries selected
      </p>
      <p className="text-sm text-[#cbd5e1]">
        Run the first ratings sync now so posters and ratings are ready when the
        app opens. Large libraries can take several minutes.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0ea5e9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
          disabled={starting || loadingLibraries || selectedCount === 0}
          onClick={() => void runSync()}
          type="button"
        >
          <RefreshCw className={clsx(starting && "animate-spin")} size={17} />
          Run first sync
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#334155] px-5 py-2.5 text-sm font-semibold hover:bg-[#1f2937] disabled:opacity-50"
          disabled={starting || loadingLibraries}
          onClick={() => void skipSync()}
          type="button"
        >
          Skip for now
          <ArrowRight size={17} />
        </button>
      </div>
      {error && (
        <p className="rounded-md border border-[#b91c1c] bg-[#450a0a] px-3 py-2 text-sm text-[#fecaca]">
          {error}
        </p>
      )}
    </div>
  );
}

function LibrarySelectionGroup({
  label,
  libraries,
  onToggle,
}: {
  label: string;
  libraries?: MovieLibrarySelection;
  onToggle: (key: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-[#263245] p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="mt-1 space-y-2">
        {libraries?.libraries.length === 0 && (
          <p className="text-xs text-[#94a3b8]">No libraries found.</p>
        )}
        {libraries?.libraries.map((library) => (
          <label
            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm hover:bg-[#1f2937]"
            key={library.key}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {library.title}
              </span>
              <span className="text-xs text-[#94a3b8]">
                {library.count ?? "-"} items
              </span>
            </span>
            <input
              aria-label={library.title}
              checked={library.selected}
              className="h-4 w-4 accent-[#38bdf8]"
              onChange={() => onToggle(library.key)}
              type="checkbox"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DoneStep() {
  return (
    <div className="flex items-center gap-3 text-sm">
      <CheckCircle2 className="text-[#22c55e]" size={22} />
      <span>Setup complete. Loading FamilySync…</span>
    </div>
  );
}
