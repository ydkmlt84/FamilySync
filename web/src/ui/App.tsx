import { useCallback, useEffect, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ArrowRight,
  Link2,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  Unlink,
  UserCircle,
  Users,
} from "lucide-react";
import { clsx } from "clsx";
import {
  AggregatedRating,
  api,
  CronJobSettings,
  FavoriteMovieRating,
  IntegrationSettings,
  LinkedUser,
  LowRatedSettings,
  ManagedHomeUser,
  MovieRatingDetails,
  MovieLibrarySelection,
  JobsSettings,
  PublicCarouselRating,
  ProtectedTagSettings,
  SyncJobStatus,
  SyncStats,
} from "./api";
import { SetupWizard } from "./SetupWizard";

function showToast(message: string) {
  toast(message);
}

export function App() {
  const [currentUser, setCurrentUser] = useState<LinkedUser>();
  const [users, setUsers] = useState<LinkedUser[]>([]);
  const [managedHomeUsers, setManagedHomeUsers] = useState<ManagedHomeUser[]>(
    [],
  );
  const [managedHomePins, setManagedHomePins] = useState<
    Record<string, string>
  >({});
  const [importingManagedUserId, setImportingManagedUserId] =
    useState<string>();
  const [favorites, setFavorites] = useState<FavoriteMovieRating[]>([]);
  const [carouselMovies, setCarouselMovies] = useState<PublicCarouselRating[]>(
    [],
  );
  const [syncStats, setSyncStats] = useState<SyncStats>();
  const [protectionThreshold, setProtectionThreshold] = useState(7);
  const [logLevel, setLogLevel] = useState<"info" | "debug">("info");
  const [protectedTagSettings, setProtectedTagSettings] =
    useState<ProtectedTagSettings>();
  const [lowRatedSettings, setLowRatedSettings] = useState<LowRatedSettings>();
  const [excludedMovies, setExcludedMovies] = useState<FavoriteMovieRating[]>(
    [],
  );
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [excludedMediaFilter, setExcludedMediaFilter] =
    useState<MediaFilter>("all");
  const [movieLibraries, setMovieLibraries] = useState<MovieLibrarySelection>();
  const [tvLibraries, setTvLibraries] = useState<MovieLibrarySelection>();
  const [radarrSettings, setRadarrSettings] = useState<IntegrationSettings>();
  const [sonarrSettings, setSonarrSettings] = useState<IntegrationSettings>();
  const [jobsSettings, setJobsSettings] = useState<JobsSettings>();
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [pin, setPin] = useState<{
    pinId: number;
    code: string;
    authUrl: string;
  }>();
  const [ratingKey, setRatingKey] = useState("");
  const [rating, setRating] = useState<AggregatedRating>();
  const [selectedMovie, setSelectedMovie] = useState<MovieRatingDetails>();
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [page, setPage] = useState<"home" | "settings">("home");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("overview");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string>();
  const [activeSyncJob, setActiveSyncJob] = useState<SyncJobStatus>();
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [refreshingLibraryData, setRefreshingLibraryData] = useState(false);
  const [refreshingManagedUsers, setRefreshingManagedUsers] = useState(false);
  const [refreshingExcluded, setRefreshingExcluded] = useState(false);
  const [integrationAction, setIntegrationAction] = useState<string>();
  const [pendingUserAction, setPendingUserAction] = useState<string>();
  const [loadingMovieKey, setLoadingMovieKey] = useState<string>();
  const [ratingLookupPending, setRatingLookupPending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupNeedsFirstAdmin, setSetupNeedsFirstAdmin] = useState(true);
  const plexPopup = useRef<Window | null>(null);

  const refreshUsers = useCallback(async () => {
    const user = await api.me();
    setCurrentUser(user);
    if (!user.isAdmin) {
      setPage("home");
    }
    setUsers(user.isAdmin ? await api.listUsers() : []);
    setSyncStats(user.isAdmin ? await api.getSyncStats() : undefined);
    if (user.isAdmin) {
      const settings = await api.getSyncSettings();
      setProtectionThreshold(settings.protectionThreshold);
      setLogLevel(settings.logLevel);
      setProtectedTagSettings(settings.protectedTag);
      setLowRatedSettings(settings.lowRated);
      setRadarrSettings(settings.radarr);
      setSonarrSettings(settings.sonarr);
    }
    setMovieLibraries(user.isAdmin ? await api.getMovieLibraries() : undefined);
    setTvLibraries(user.isAdmin ? await api.getTvLibraries() : undefined);
    setJobsSettings(user.isAdmin ? await api.getJobsSettings() : undefined);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      await refreshUsers();
    } catch {
      setCurrentUser(undefined);
      setUsers([]);
    }
  }, [refreshUsers]);

  const refreshFavorites = useCallback(async () => {
    if (!currentUser) {
      setFavorites([]);
      return;
    }

    try {
      const result = await api.listFavorites();
      setFavorites(result);
      setFavoriteIndex(0);
    } catch {
      setFavorites([]);
      setFavoriteIndex(0);
    }
  }, [currentUser]);

  const refreshPublicCarousel = useCallback(async () => {
    try {
      setCarouselMovies(await api.listPublicCarousel());
      setFavoriteIndex(0);
    } catch {
      setCarouselMovies([]);
      setFavoriteIndex(0);
    }
  }, []);

  const refreshSyncStats = useCallback(async () => {
    try {
      setSyncStats(await api.getSyncStats());
    } catch {
      setSyncStats(undefined);
    }
  }, []);

  const refreshExcludedMovies = useCallback(async () => {
    setRefreshingExcluded(true);

    try {
      setExcludedMovies(await api.listExcluded());
    } catch {
      setExcludedMovies([]);
    } finally {
      setRefreshingExcluded(false);
    }
  }, []);

  const refreshManagedHomeUsers = useCallback(async () => {
    if (!currentUser?.isAdmin) {
      setManagedHomeUsers([]);
      return;
    }

    setRefreshingManagedUsers(true);

    try {
      setManagedHomeUsers(await api.listManagedHomeUsers());
    } catch (error) {
      setManagedHomeUsers([]);
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshingManagedUsers(false);
    }
  }, [currentUser?.isAdmin]);

  useEffect(() => {
    void refreshSession();
    void api
      .getSetupStatus()
      .then((status) => {
        setSetupRequired(status.setupRequired);
        setSetupNeedsFirstAdmin(status.needsFirstAdmin);
      })
      .catch(() => setSetupRequired(false));
  }, [refreshSession]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      void refreshSyncStats();
    }

    void refreshFavorites();
    void refreshPublicCarousel();
  }, [
    currentUser?.id,
    currentUser?.isAdmin,
    refreshFavorites,
    refreshPublicCarousel,
    refreshSyncStats,
  ]);

  useEffect(() => {
    if (carouselMovies.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setFavoriteIndex((index) => (index + 1) % carouselMovies.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [carouselMovies.length]);

  useEffect(() => {
    setFavoriteIndex(0);
  }, [carouselMovies.length]);

  useEffect(() => {
    if (
      currentUser?.isAdmin &&
      page === "settings" &&
      settingsTab === "users"
    ) {
      void refreshManagedHomeUsers();
    }
  }, [
    currentUser?.id,
    currentUser?.isAdmin,
    page,
    refreshManagedHomeUsers,
    settingsTab,
    users.length,
  ]);

  useEffect(() => {
    if (!pin) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const result = await api.pollPin(pin.pinId);

        if (result.linked) {
          window.clearInterval(interval);
          plexPopup.current?.close();
          plexPopup.current = null;
          setPin(undefined);
          showToast(`Linked ${result.user?.plexUsername ?? "Plex user"}.`);
          await refreshSession();

          try {
            const status = await api.getSetupStatus();
            setSetupRequired(status.setupRequired);
            setSetupNeedsFirstAdmin(status.needsFirstAdmin);
          } catch {
            setSetupRequired(false);
          }
        }
      } catch (error) {
        window.clearInterval(interval);
        plexPopup.current?.close();
        plexPopup.current = null;
        setPin(undefined);
        showToast(error instanceof Error ? error.message : String(error));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [pin, refreshSession]);

  if (window.location.pathname === "/auth/plex/loading") {
    return <PlexPopupLoading />;
  }

  if (setupRequired) {
    return (
      <SetupWizard
        busy={ratingLookupPending}
        currentUser={currentUser}
        needsFirstAdmin={setupNeedsFirstAdmin}
        onComplete={async () => {
          setSetupRequired(false);
          await refreshSession();
        }}
        onJoin={joinWithPlex}
        pinCode={pin?.code}
      />
    );
  }

  async function refreshLinkedUsers() {
    setRefreshingUsers(true);

    try {
      await refreshUsers();
      await refreshManagedHomeUsers();
    } finally {
      setRefreshingUsers(false);
    }
  }

  async function refreshLibraryData() {
    setRefreshingLibraryData(true);

    try {
      setSyncStats(await api.refreshSyncStats());
      await refreshFavorites();
      await refreshPublicCarousel();
      showToast("Library data refreshed.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshingLibraryData(false);
    }
  }

  async function saveProtectionThreshold(value: number) {
    setProtectionThreshold(value);

    try {
      const result = await api.updateSyncSettings({
        protectionThreshold: value,
      });
      setProtectionThreshold(result.protectionThreshold);
      setLogLevel(result.logLevel);
      setProtectedTagSettings(result.protectedTag);
      setLowRatedSettings(result.lowRated);
      setRadarrSettings(result.radarr);
      setSonarrSettings(result.sonarr);
      setSyncStats(await api.refreshSyncStats());
      await refreshFavorites();
      showToast(`Protected threshold set to ${result.protectionThreshold}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshMovieLibraries() {
    try {
      setMovieLibraries(await api.getMovieLibraries());
    } catch {
      setMovieLibraries(undefined);
    }
  }

  async function refreshTvLibraries() {
    try {
      setTvLibraries(await api.getTvLibraries());
    } catch {
      setTvLibraries(undefined);
    }
  }

  async function saveIntegrationSettings(
    service: "radarr" | "sonarr",
    settings: IntegrationSettings,
  ) {
    setIntegrationAction(`${service}:save`);

    try {
      const result = await api.updateSyncSettings({
        protectionThreshold,
        [service]: settings,
      });
      setProtectionThreshold(result.protectionThreshold);
      setLogLevel(result.logLevel);
      setProtectedTagSettings(result.protectedTag);
      setLowRatedSettings(result.lowRated);
      setRadarrSettings(result.radarr);
      setSonarrSettings(result.sonarr);
      showToast(
        `${service === "radarr" ? "Radarr" : "Sonarr"} settings saved.`,
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setIntegrationAction(undefined);
    }
  }

  async function testIntegration(service: "radarr" | "sonarr") {
    setIntegrationAction(`${service}:test`);

    try {
      if (service === "radarr") {
        if (!radarrSettings) {
          return;
        }

        const result = await api.testRadarr(radarrSettings);
        showToast(`Radarr connected: ${result.movieCount} movies found.`);
        return;
      }

      if (!sonarrSettings) {
        return;
      }

      const result = await api.testSonarr(sonarrSettings);
      showToast(`Sonarr connected: ${result.seriesCount} series found.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setIntegrationAction(undefined);
    }
  }

  async function saveLogLevel(value: "info" | "debug") {
    setLogLevel(value);

    try {
      const result = await api.updateSyncSettings({ logLevel: value });
      setProtectionThreshold(result.protectionThreshold);
      setLogLevel(result.logLevel);
      setProtectedTagSettings(result.protectedTag);
      setLowRatedSettings(result.lowRated);
      setRadarrSettings(result.radarr);
      setSonarrSettings(result.sonarr);
      showToast(`Log level set to ${result.logLevel}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveLowRatedSettings(settings: LowRatedSettings) {
    setLowRatedSettings(settings);

    try {
      const result = await api.updateSyncSettings({ lowRated: settings });
      setProtectionThreshold(result.protectionThreshold);
      setLogLevel(result.logLevel);
      setProtectedTagSettings(result.protectedTag);
      setLowRatedSettings(result.lowRated);
      setRadarrSettings(result.radarr);
      setSonarrSettings(result.sonarr);
      showToast("Low-rated tag settings saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveProtectedTagSettings(settings: ProtectedTagSettings) {
    setProtectedTagSettings(settings);

    try {
      const result = await api.updateSyncSettings({ protectedTag: settings });
      setProtectionThreshold(result.protectionThreshold);
      setLogLevel(result.logLevel);
      setProtectedTagSettings(result.protectedTag);
      setLowRatedSettings(result.lowRated);
      setRadarrSettings(result.radarr);
      setSonarrSettings(result.sonarr);
      showToast("Protected tag settings saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function importManagedHomeUser(user: ManagedHomeUser) {
    setImportingManagedUserId(user.id);

    try {
      await api.importManagedHomeUser(user.id, managedHomePins[user.id]);
      setManagedHomePins((current) => ({ ...current, [user.id]: "" }));
      await refreshLinkedUsers();
      showToast(`${user.title} imported.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setImportingManagedUserId(undefined);
    }
  }

  async function saveJobsSettings(next: JobsSettings) {
    setJobsSettings(next);

    try {
      setJobsSettings(await api.updateJobsSettings(next));
      showToast("Job schedule saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function pollSyncJob(job: SyncJobStatus) {
    setActiveSyncJob(job);

    while (true) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const latest = await api.getSyncJob(job.id);
      setActiveSyncJob(latest);

      if (latest.status !== "running") {
        await refreshUsers();
        await refreshFavorites();
        await refreshPublicCarousel();
        await refreshSyncStats();

        if (latest.status === "completed") {
          showToast(
            `${latest.label} complete: ${latest.syncedMovies} synced${
              latest.cachedSkips > 0
                ? `, ${latest.cachedSkips} recently scanned`
                : ""
            }${
              latest.skippedMovies > 0
                ? `, ${latest.skippedMovies} sync errors`
                : ""
            }${latest.error ? ` (${latest.error})` : ""}.`,
          );
        } else {
          showToast(
            `${latest.label} failed: ${latest.error ?? "Unknown error"}`,
          );
        }

        setActiveSyncJob(undefined);
        break;
      }
    }
  }

  async function toggleMovieLibrary(key: string) {
    const currentKeys =
      movieLibraries?.libraries
        .filter((library) => library.selected)
        .map((library) => library.key) ?? [];
    const selectedKeys = currentKeys.includes(key)
      ? currentKeys.filter((selectedKey) => selectedKey !== key)
      : [...currentKeys, key];

    await api.updateMovieLibraries(selectedKeys);
    await refreshMovieLibraries();
    setSyncStats(await api.refreshSyncStats());
  }

  async function toggleTvLibrary(key: string) {
    const currentKeys =
      tvLibraries?.libraries
        .filter((library) => library.selected)
        .map((library) => library.key) ?? [];
    const selectedKeys = currentKeys.includes(key)
      ? currentKeys.filter((selectedKey) => selectedKey !== key)
      : [...currentKeys, key];

    await api.updateTvLibraries(selectedKeys);
    await refreshTvLibraries();
    setSyncStats(await api.refreshSyncStats());
  }

  async function joinWithPlex() {
    setRatingLookupPending(true);
    plexPopup.current = openCenteredPopup(
      "/auth/plex/loading",
      "Plex Auth",
      600,
      700,
    );

    try {
      if (!plexPopup.current) {
        throw new Error(
          "Unable to open Plex login window. Allow popups for this site and try again.",
        );
      }

      const createdPin = await api.createPin();
      plexPopup.current.location.href = createdPin.authUrl;
      setPin(createdPin);
    } catch (error) {
      plexPopup.current?.close();
      plexPopup.current = null;
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRatingLookupPending(false);
    }
  }

  async function forceSync() {
    setSyncing(true);

    try {
      const job = await api.forceSync();
      showToast("Full sync started.");
      await pollSyncJob(job);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }

  async function forceTagSync() {
    setSyncing(true);

    try {
      const job = await api.syncTags();
      showToast("Tag sync started.");
      await pollSyncJob(job);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }

  async function forceMetadataSync() {
    setSyncing(true);

    try {
      const job = await api.syncMetadata();
      showToast("Plex metadata refresh started.");
      await pollSyncJob(job);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }

  async function queryRating() {
    if (!ratingKey.trim()) {
      return;
    }

    setBusy(true);
    try {
      setRating(await api.getRating(ratingKey.trim()));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function openMovieDetails(movie: FavoriteMovieRating) {
    if (!currentUser) {
      return;
    }

    setLoadingMovieKey(movie.ratingKey);

    try {
      setSelectedMovie(await api.getRatingDetails(movie.ratingKey));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingMovieKey(undefined);
    }
  }

  async function openExcludedModal() {
    setShowExcludedModal(true);
    await refreshExcludedMovies();
  }

  async function openExcludedMovie(movie: FavoriteMovieRating) {
    setShowExcludedModal(false);
    await openMovieDetails(movie);
  }

  async function setMovieTaggingExcluded(
    movie: MovieRatingDetails,
    taggingExcluded: boolean,
  ) {
    try {
      const updated = await api.updateMediaOverride(
        movie.ratingKey,
        taggingExcluded,
      );
      setSelectedMovie(updated);
      setFavorites((current) =>
        current.map((entry) =>
          entry.ratingKey === updated.ratingKey
            ? {
                ...entry,
                taggingExcluded: updated.taggingExcluded,
                lowRated: updated.lowRated,
              }
            : entry,
        ),
      );
      await refreshExcludedMovies();
      showToast(
        taggingExcluded ? "Excluded from tag sync." : "Included in tag sync.",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeUser(id: string) {
    setPendingUserAction(`${id}:remove`);

    try {
      await api.removeUser(id);
      await refreshLinkedUsers();
      await refreshSyncStats();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingUserAction(undefined);
    }
  }

  async function toggleUser(user: LinkedUser) {
    setPendingUserAction(`${user.id}:toggle`);

    try {
      await api.setUserEnabled(user.id, !user.enabled);
      await refreshLinkedUsers();
      await refreshSyncStats();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingUserAction(undefined);
    }
  }

  async function syncUser(user: LinkedUser) {
    setSyncingUserId(user.id);

    try {
      const job = await api.syncUser(user.id);
      showToast(`${user.plexUsername} sync started.`);
      await pollSyncJob(job);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncingUserId(undefined);
    }
  }

  async function logout() {
    setLoggingOut(true);

    try {
      await api.logout();
      setCurrentUser(undefined);
      setUsers([]);
      setManagedHomeUsers([]);
      setPage("home");
      setSyncStats(undefined);
      setProtectionThreshold(7);
      setLogLevel("info");
      setProtectedTagSettings(undefined);
      setLowRatedSettings(undefined);
      setMovieLibraries(undefined);
      setTvLibraries(undefined);
      setJobsSettings(undefined);
      setRadarrSettings(undefined);
      setSonarrSettings(undefined);
      await refreshFavorites();
      showToast("Signed out.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setLoggingOut(false);
    }
  }

  const filteredFavorites = filterMediaByType(favorites, mediaFilter);

  return (
    <main className="min-h-screen bg-[#0b1120] text-[#e5e7eb]">
      <header className="sticky top-0 z-30 border-b border-[#263245] bg-[#111827]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <LogoMark onClick={() => setPage("home")} />
            <div>
              <h1 className="text-xl font-semibold tracking-normal">
                FamilySync
              </h1>
              <p className="hidden text-sm text-[#94a3b8] sm:block">
                Maintainerr Companion App
              </p>
            </div>
          </div>
          {currentUser && (
            <UserArea
              currentUser={currentUser}
              loggingOut={loggingOut}
              onLogout={logout}
              onSettings={
                currentUser.isAdmin
                  ? () =>
                      setPage((current) =>
                        current === "settings" ? "home" : "settings",
                      )
                  : undefined
              }
              settingsActive={page === "settings"}
            />
          )}
        </div>
      </header>

      <LandingHero
        busy={busy}
        currentUser={currentUser}
        favoriteIndex={favoriteIndex}
        favorites={carouselMovies}
        onJoin={joinWithPlex}
      />

      {currentUser && page === "home" && (
        <>
          <PosterGrid
            loadingMovieKey={loadingMovieKey}
            mediaFilter={mediaFilter}
            movies={filteredFavorites}
            onFilterChange={setMediaFilter}
            onMovieClick={openMovieDetails}
            onShowExcluded={
              currentUser.isAdmin ? () => void openExcludedModal() : undefined
            }
          />
        </>
      )}

      {currentUser?.isAdmin && page === "settings" && (
        <div className="mx-auto max-w-6xl px-5 pb-8">
          <SettingsTabs activeTab={settingsTab} onChange={setSettingsTab} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section
              className={clsx(
                "space-y-6",
                settingsTab === "users" && "lg:col-span-2",
                (settingsTab === "libraries" ||
                  settingsTab === "protection" ||
                  settingsTab === "connections" ||
                  settingsTab === "jobs") &&
                  "hidden",
              )}
            >
              {settingsTab === "overview" && (
                <AdminConnectionCard
                  currentUser={currentUser}
                  linkedUserCount={users.length}
                />
              )}

              {settingsTab === "users" && currentUser && (
                <>
                  <div className="rounded-md border border-[#263245] bg-[#111827]">
                    <div className="flex items-center justify-between border-b border-[#263245] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={18} />
                        <h2 className="text-base font-semibold">
                          {currentUser?.isAdmin ? "Linked Users" : "Access"}
                        </h2>
                      </div>
                      {currentUser?.isAdmin && (
                        <button
                          className="rounded-md p-2 hover:bg-[#1f2937]"
                          disabled={refreshingUsers}
                          onClick={refreshLinkedUsers}
                          title="Refresh users"
                        >
                          <RefreshCw
                            className={clsx(refreshingUsers && "animate-spin")}
                            size={17}
                          />
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-[#263245]">
                      {currentUser && !currentUser.isAdmin && (
                        <p className="px-4 py-5 text-sm text-[#94a3b8]">
                          Your account is linked. Admin controls are only
                          available to the Plex server admin.
                        </p>
                      )}
                      {currentUser?.isAdmin && users.length === 0 && (
                        <p className="px-4 py-5 text-sm text-[#94a3b8]">
                          No Plex users linked yet.
                        </p>
                      )}
                      {currentUser?.isAdmin &&
                        users.map((user) => (
                          <div
                            className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]"
                            key={user.id}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {user.plexThumb ? (
                                <img
                                  alt=""
                                  className="h-10 w-10 rounded-md object-cover"
                                  src={user.plexThumb}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md bg-[#334155]" />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium">
                                    {user.plexUsername}
                                  </p>
                                  {user.isAdmin && <Badge label="Admin" />}
                                  {user.isManaged && <Badge label="Managed" />}
                                  <Badge
                                    label={
                                      user.enabled ? "Enabled" : "Disabled"
                                    }
                                    muted={!user.enabled}
                                  />
                                </div>
                                <p className="text-sm text-[#94a3b8]">
                                  Last sync{" "}
                                  {user.lastSyncAt
                                    ? new Date(user.lastSyncAt).toLocaleString()
                                    : "never"}
                                </p>
                                {user.plexServerName && (
                                  <p className="text-xs text-[#94a3b8]">
                                    Server {user.plexServerName}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                                disabled={syncingUserId === user.id}
                                onClick={() => syncUser(user)}
                                title="Sync this user's ratings"
                              >
                                <RefreshCw
                                  className={clsx(
                                    syncingUserId === user.id && "animate-spin",
                                  )}
                                  size={17}
                                />
                              </button>
                              {!user.isAdmin && (
                                <>
                                  <button
                                    className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                                    disabled={pendingUserAction?.startsWith(
                                      `${user.id}:`,
                                    )}
                                    onClick={() => toggleUser(user)}
                                    title={
                                      user.enabled
                                        ? "Disable user"
                                        : "Enable user"
                                    }
                                  >
                                    {pendingUserAction ===
                                    `${user.id}:toggle` ? (
                                      <RefreshCw
                                        className="animate-spin"
                                        size={17}
                                      />
                                    ) : (
                                      <Unlink size={17} />
                                    )}
                                  </button>
                                  <button
                                    className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                                    disabled={pendingUserAction?.startsWith(
                                      `${user.id}:`,
                                    )}
                                    onClick={() => removeUser(user.id)}
                                    title="Remove user"
                                  >
                                    {pendingUserAction ===
                                    `${user.id}:remove` ? (
                                      <RefreshCw
                                        className="animate-spin"
                                        size={17}
                                      />
                                    ) : (
                                      <Trash2 size={17} />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  {currentUser.isAdmin && (
                    <ManagedHomeUsersPanel
                      importingUserId={importingManagedUserId}
                      refreshing={refreshingManagedUsers}
                      pins={managedHomePins}
                      users={managedHomeUsers}
                      onImport={importManagedHomeUser}
                      onPinChange={(userId, pin) =>
                        setManagedHomePins((current) => ({
                          ...current,
                          [userId]: pin,
                        }))
                      }
                      onRefresh={refreshManagedHomeUsers}
                    />
                  )}
                </>
              )}
            </section>

            <aside
              className={clsx(
                "space-y-6",
                settingsTab === "users" && "hidden",
                (settingsTab === "libraries" ||
                  settingsTab === "protection" ||
                  settingsTab === "connections" ||
                  settingsTab === "jobs") &&
                  "lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0",
              )}
            >
              {settingsTab === "libraries" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Users size={18} />
                    <h2 className="text-base font-semibold">Movie Libraries</h2>
                  </div>
                  <div className="mt-4 space-y-2">
                    {movieLibraries?.libraries.length === 0 && (
                      <p className="text-sm text-[#94a3b8]">
                        No Plex movie libraries found.
                      </p>
                    )}
                    {movieLibraries?.libraries.map((library) => (
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
                          checked={library.selected}
                          className="h-4 w-4 accent-[#38bdf8]"
                          onChange={() => toggleMovieLibrary(library.key)}
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[#94a3b8]">
                    Selected movie libraries are used by full sync and
                    individual user sync.
                  </p>
                </div>
              )}

              {settingsTab === "libraries" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Users size={18} />
                    <h2 className="text-base font-semibold">TV Libraries</h2>
                  </div>
                  <div className="mt-4 space-y-2">
                    {tvLibraries?.libraries.length === 0 && (
                      <p className="text-sm text-[#94a3b8]">
                        No Plex TV libraries found.
                      </p>
                    )}
                    {tvLibraries?.libraries.map((library) => (
                      <label
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm hover:bg-[#1f2937]"
                        key={library.key}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {library.title}
                          </span>
                          <span className="text-xs text-[#94a3b8]">
                            {library.count ?? "-"} shows
                          </span>
                        </span>
                        <input
                          checked={library.selected}
                          className="h-4 w-4 accent-[#38bdf8]"
                          onChange={() => toggleTvLibrary(library.key)}
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[#94a3b8]">
                    TV sync includes show, season, and episode rating keys from
                    selected TV libraries.
                  </p>
                </div>
              )}

              {settingsTab === "protection" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Shield size={18} />
                    <h2 className="text-base font-semibold">Protection</h2>
                  </div>
                  {protectedTagSettings && (
                    <div className="mt-4 rounded-md border border-[#263245] p-3">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="block font-medium">
                            Protected tag
                          </span>
                          <span className="text-xs text-[#94a3b8]">
                            Tag media when any linked user rating meets the
                            threshold.
                          </span>
                        </span>
                        <input
                          checked={protectedTagSettings.enabled}
                          className="h-4 w-4 accent-[#38bdf8]"
                          onChange={(event) =>
                            saveProtectedTagSettings({
                              ...protectedTagSettings,
                              enabled: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="text-[#94a3b8]">Tag name</span>
                          <input
                            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                            defaultValue={protectedTagSettings.tagName}
                            onBlur={(event) =>
                              saveProtectedTagSettings({
                                ...protectedTagSettings,
                                tagName: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="text-[#94a3b8]">
                            Any rating at or above
                          </span>
                          <input
                            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                            max={10}
                            min={0}
                            onBlur={(event) =>
                              saveProtectionThreshold(
                                Number(event.target.value),
                              )
                            }
                            step={0.5}
                            type="number"
                            defaultValue={protectionThreshold}
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm sm:col-span-2">
                          <span className="text-[#94a3b8]">
                            Remove when no longer protected
                          </span>
                          <input
                            checked={
                              protectedTagSettings.removeTagsWhenUnprotected
                            }
                            className="h-4 w-4 accent-[#38bdf8]"
                            onChange={(event) =>
                              saveProtectedTagSettings({
                                ...protectedTagSettings,
                                removeTagsWhenUnprotected: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {lowRatedSettings && (
                    <div className="mt-4 rounded-md border border-[#263245] p-3">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="block font-medium">
                            Low-rated tag
                          </span>
                          <span className="text-xs text-[#94a3b8]">
                            Tag media when enough linked users rate it poorly.
                          </span>
                        </span>
                        <input
                          checked={lowRatedSettings.enabled}
                          className="h-4 w-4 accent-[#38bdf8]"
                          onChange={(event) =>
                            saveLowRatedSettings({
                              ...lowRatedSettings,
                              enabled: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="text-[#94a3b8]">Tag name</span>
                          <input
                            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                            onBlur={(event) =>
                              saveLowRatedSettings({
                                ...lowRatedSettings,
                                tagName: event.target.value,
                              })
                            }
                            defaultValue={lowRatedSettings.tagName}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="text-[#94a3b8]">
                            Average at or below
                          </span>
                          <input
                            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                            max={10}
                            min={0}
                            onBlur={(event) =>
                              saveLowRatedSettings({
                                ...lowRatedSettings,
                                averageThreshold: Number(event.target.value),
                              })
                            }
                            step={0.5}
                            type="number"
                            defaultValue={lowRatedSettings.averageThreshold}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="text-[#94a3b8]">
                            Minimum ratings
                          </span>
                          <input
                            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                            min={1}
                            onBlur={(event) =>
                              saveLowRatedSettings({
                                ...lowRatedSettings,
                                minimumRatings: Number(event.target.value),
                              })
                            }
                            type="number"
                            defaultValue={lowRatedSettings.minimumRatings}
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
                          <span className="text-[#94a3b8]">
                            Remove when no longer low-rated
                          </span>
                          <input
                            checked={lowRatedSettings.removeTagsWhenNotLowRated}
                            className="h-4 w-4 accent-[#38bdf8]"
                            onChange={(event) =>
                              saveLowRatedSettings({
                                ...lowRatedSettings,
                                removeTagsWhenNotLowRated: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                        </label>
                      </div>
                      <p className="mt-3 text-xs text-[#94a3b8]">
                        Default rule: at least 2 ratings and average 4 or lower.
                      </p>
                    </div>
                  )}
                  <label className="mt-4 block text-sm">
                    <span className="text-[#94a3b8]">Log level</span>
                    <select
                      className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                      onChange={(event) =>
                        saveLogLevel(event.target.value as "info" | "debug")
                      }
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
              )}

              {settingsTab === "connections" &&
                currentUser?.isAdmin &&
                radarrSettings && (
                  <IntegrationSettingsCard
                    label="Radarr"
                    pendingAction={
                      integrationAction?.startsWith("radarr:")
                        ? (integrationAction.split(":")[1] as "save" | "test")
                        : undefined
                    }
                    settings={radarrSettings}
                    onChange={setRadarrSettings}
                    onSave={() =>
                      saveIntegrationSettings("radarr", radarrSettings)
                    }
                    onTest={() => testIntegration("radarr")}
                  />
                )}

              {settingsTab === "connections" &&
                currentUser?.isAdmin &&
                sonarrSettings && (
                  <IntegrationSettingsCard
                    label="Sonarr"
                    pendingAction={
                      integrationAction?.startsWith("sonarr:")
                        ? (integrationAction.split(":")[1] as "save" | "test")
                        : undefined
                    }
                    settings={sonarrSettings}
                    onChange={setSonarrSettings}
                    onSave={() =>
                      saveIntegrationSettings("sonarr", sonarrSettings)
                    }
                    onTest={() => testIntegration("sonarr")}
                  />
                )}

              {settingsTab === "jobs" &&
                currentUser?.isAdmin &&
                jobsSettings && (
                  <JobsSettingsPanel
                    activeJob={activeSyncJob}
                    jobsSettings={jobsSettings}
                    onChange={saveJobsSettings}
                    onRunMetadataSync={forceMetadataSync}
                    onRunRatingSync={forceSync}
                    onRunTagSync={forceTagSync}
                    running={syncing}
                  />
                )}

              {settingsTab === "overview" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Shield size={18} />
                    <h2 className="text-base font-semibold">Library Data</h2>
                    <button
                      className="ml-auto rounded-md p-2 hover:bg-[#1f2937]"
                      disabled={refreshingLibraryData}
                      onClick={refreshLibraryData}
                      title="Refresh library data"
                    >
                      <RefreshCw
                        className={clsx(
                          refreshingLibraryData && "animate-spin",
                        )}
                        size={16}
                      />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Metric
                      label="Movies"
                      value={syncStats?.cachedMovies ?? "-"}
                    />
                    <Metric
                      label="Shows"
                      value={syncStats?.cachedShows ?? "-"}
                    />
                    <Metric
                      label="Seasons"
                      value={syncStats?.cachedSeasons ?? "-"}
                    />
                    <Metric
                      label="Episodes"
                      value={syncStats?.cachedEpisodes ?? "-"}
                    />
                    <Metric
                      label="Rated"
                      value={syncStats?.ratedMedia ?? "-"}
                    />
                    <Metric
                      label="Unrated"
                      value={syncStats?.unratedMedia ?? "-"}
                    />
                    <Metric
                      label="Excluded"
                      value={syncStats?.excludedMedia ?? "-"}
                    />
                    <Metric
                      label="User-Media Rows"
                      value={syncStats?.cachedEntries ?? "-"}
                    />
                  </div>
                  <p className="mt-3 text-xs text-[#94a3b8]">
                    Rows are per linked user per cached Plex media item.
                  </p>
                  <p className="mt-3 text-xs text-[#94a3b8]">
                    Last updated{" "}
                    {syncStats?.lastUpdatedAt
                      ? new Date(syncStats.lastUpdatedAt).toLocaleString()
                      : "never"}
                  </p>
                </div>
              )}

              {settingsTab === "overview" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Shield size={18} />
                    <h2 className="text-base font-semibold">Sync</h2>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <SyncActionButton
                      color="blue"
                      label="Ratings"
                      onClick={forceSync}
                      pending={syncing && activeSyncJob?.scope === "full"}
                      running={syncing}
                    />
                    <SyncActionButton
                      color="teal"
                      label="Tags"
                      onClick={forceTagSync}
                      pending={syncing && activeSyncJob?.scope === "tags"}
                      running={syncing}
                    />
                    <SyncActionButton
                      color="purple"
                      label="Metadata"
                      onClick={forceMetadataSync}
                      pending={syncing && activeSyncJob?.scope === "metadata"}
                      running={syncing}
                    />
                  </div>
                  {syncing && <SyncProgress job={activeSyncJob} />}
                </div>
              )}

              {settingsTab === "overview" && currentUser?.isAdmin && (
                <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
                  <div className="flex items-center gap-2">
                    <Search size={18} />
                    <h2 className="text-base font-semibold">Rating Lookup</h2>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
                      onChange={(event) => setRatingKey(event.target.value)}
                      placeholder="Plex ratingKey"
                      value={ratingKey}
                    />
                    <button
                      className="rounded-md bg-[#0f766e] px-3 py-2 text-white hover:bg-[#0d9488] disabled:opacity-50"
                      disabled={ratingLookupPending}
                      onClick={queryRating}
                      title="Lookup"
                    >
                      {ratingLookupPending ? (
                        <RefreshCw className="animate-spin" size={17} />
                      ) : (
                        <Search size={17} />
                      )}
                    </button>
                  </div>
                  {rating && (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <Metric label="Highest" value={rating.highest ?? "-"} />
                        <Metric
                          label="Average"
                          value={rating.average?.toFixed(1) ?? "-"}
                        />
                        <Metric label="Count" value={rating.count} />
                        <Metric
                          label="Protected"
                          value={rating.protected ? "Yes" : "No"}
                        />
                      </div>
                      <div className="divide-y divide-[#263245]">
                        {rating.ratings.map((entry) => (
                          <div
                            className="flex justify-between py-2"
                            key={entry.plexUserId}
                          >
                            <span>{entry.user}</span>
                            <span className="font-medium">{entry.rating}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {pin && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border border-[#263245] bg-[#111827] px-4 py-3 text-sm shadow-lg">
          Plex authorization pending for code{" "}
          <span className="font-semibold">{pin.code}</span>
        </div>
      )}

      <ToastContainer
        autoClose={5000}
        newestOnTop
        position="top-right"
        theme="dark"
      />
      {selectedMovie && (
        <RatingsModal
          currentUser={currentUser}
          movie={selectedMovie}
          onClose={() => setSelectedMovie(undefined)}
          onSetTaggingExcluded={(excluded) =>
            setMovieTaggingExcluded(selectedMovie, excluded)
          }
        />
      )}
      {showExcludedModal && currentUser?.isAdmin && (
        <ExcludedMediaModal
          loadingMovieKey={loadingMovieKey}
          mediaFilter={excludedMediaFilter}
          movies={excludedMovies}
          onClose={() => setShowExcludedModal(false)}
          onFilterChange={setExcludedMediaFilter}
          onMovieClick={openExcludedMovie}
          onRefresh={refreshExcludedMovies}
          refreshing={refreshingExcluded}
        />
      )}
    </main>
  );
}

type SettingsTab =
  | "overview"
  | "users"
  | "libraries"
  | "protection"
  | "connections"
  | "jobs";

type MediaFilter = "all" | "movie" | "show" | "season" | "episode";

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

function SettingsTabs({
  activeTab,
  onChange,
}: {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "libraries", label: "Libraries" },
    { id: "protection", label: "Protection" },
    { id: "connections", label: "Connections" },
    { id: "jobs", label: "Jobs" },
  ];

  return (
    <div className="overflow-x-auto border-b border-[#263245]">
      <div className="flex min-w-max gap-2 py-3">
        {tabs.map((tab) => (
          <button
            className={clsx(
              "rounded-md px-3 py-2 text-sm font-medium transition hover:bg-[#1f2937]",
              activeTab === tab.id
                ? "bg-[#0ea5e9] text-white"
                : "bg-[#111827] text-[#94a3b8]",
            )}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ManagedHomeUsersPanel({
  importingUserId,
  onImport,
  onPinChange,
  onRefresh,
  pins,
  refreshing,
  users,
}: {
  importingUserId?: string;
  onImport: (user: ManagedHomeUser) => void;
  onPinChange: (userId: string, pin: string) => void;
  onRefresh: () => void;
  pins: Record<string, string>;
  refreshing: boolean;
  users: ManagedHomeUser[];
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827]">
      <div className="flex items-center justify-between border-b border-[#263245] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={18} />
          <h2 className="text-base font-semibold">Plex Home Managed Users</h2>
        </div>
        <button
          className="rounded-md p-2 hover:bg-[#1f2937] disabled:opacity-50"
          disabled={refreshing}
          onClick={onRefresh}
          title="Refresh managed users"
          type="button"
        >
          <RefreshCw className={clsx(refreshing && "animate-spin")} size={17} />
        </button>
      </div>
      {users.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[#94a3b8]">
          No managed Plex Home users were found for the linked admin account.
        </p>
      ) : (
        <div className="divide-y divide-[#263245]">
          {users.map((user) => (
            <div
              className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]"
              key={user.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                {user.thumb ? (
                  <img
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                    src={user.thumb}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#334155] text-sm font-semibold">
                    {user.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.title}</p>
                    <Badge label={user.linked ? "Imported" : "Managed"} />
                    {user.protected && <Badge label="PIN" muted />}
                  </div>
                  <p className="text-xs text-[#94a3b8]">
                    Plex Home user {user.id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {!user.linked && user.protected && (
                  <input
                    className="w-28 rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
                    onChange={(event) =>
                      onPinChange(user.id, event.target.value)
                    }
                    placeholder="PIN"
                    type="password"
                    value={pins[user.id] ?? ""}
                  />
                )}
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-[#334155] px-3 py-2 text-sm hover:bg-[#1f2937] disabled:opacity-50"
                  disabled={user.linked || importingUserId === user.id}
                  onClick={() => onImport(user)}
                  type="button"
                >
                  {importingUserId === user.id ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                  {user.linked
                    ? "Imported"
                    : importingUserId === user.id
                      ? "Importing"
                      : "Import"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserArea({
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

function LandingHero({
  busy,
  currentUser,
  favoriteIndex,
  favorites,
  onJoin,
}: {
  busy: boolean;
  currentUser?: LinkedUser;
  favoriteIndex: number;
  favorites: PublicCarouselRating[];
  onJoin: () => void;
}) {
  return (
    <section className="border-b border-[#263245] bg-[#0f172a]">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="max-w-2xl">
          <h2 className="mt-3 text-4xl font-semibold tracking-normal text-[#f8fafc] sm:text-5xl">
            Family ratings, collected from the people who made them.
          </h2>
          {!currentUser && (
            <button
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0ea5e9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0284c7] disabled:opacity-50"
              disabled={busy}
              onClick={onJoin}
            >
              {busy ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <Link2 size={18} />
              )}
              {busy ? "Connecting" : "Continue with Plex"}
              <ArrowRight size={17} />
            </button>
          )}
        </div>

        <StatusPreview favoriteIndex={favoriteIndex} favorites={favorites} />
      </div>
    </section>
  );
}

function StatusPreview({
  favoriteIndex,
  favorites,
}: {
  favoriteIndex: number;
  favorites: PublicCarouselRating[];
}) {
  return (
    <FamilyFavoritesCarousel
      favoriteIndex={favoriteIndex}
      favorites={favorites}
    />
  );
}

function FamilyFavoritesCarousel({
  favoriteIndex,
  favorites,
}: {
  favoriteIndex: number;
  favorites: PublicCarouselRating[];
}) {
  const favorite = favorites[favoriteIndex];

  if (!favorite) {
    return (
      <div className="rounded-md border border-[#263245] bg-[#020617] p-4">
        <div className="rounded-md bg-[#111827] p-4 shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#263245] pb-3">
            <Shield size={18} />
            <div>
              <p className="text-sm font-semibold">Perfect family ratings</p>
              <p className="text-xs text-[#94a3b8]">
                Media with an average 10 will appear here
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#94a3b8]">
            No media has an average 10 rating yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#263245] bg-[#020617] p-4">
      <div className="rounded-md bg-[#111827] p-4 shadow-sm">
        <div className="grid grid-cols-[136px_1fr] gap-4">
          <div className="aspect-2/3 overflow-hidden rounded-md border border-[#263245] bg-[#0f172a]">
            {favorite.posterUrl ? (
              <img
                alt=""
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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-semibold leading-snug">
                  {favorite.title ?? `Plex ratingKey ${favorite.ratingKey}`}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric
                label="Average"
                value={favorite.average?.toFixed(1) ?? "-"}
              />
              <Metric label="Ratings" value={favorite.count} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminConnectionCard({
  currentUser,
  linkedUserCount,
}: {
  currentUser: LinkedUser;
  linkedUserCount: number;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#020617] p-4">
      <div className="rounded-md bg-[#111827] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#263245] pb-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {currentUser.plexServerName ?? "Configured Plex server"}
            </p>
            <p className="text-xs text-[#94a3b8]">
              Current FamilySync connection
            </p>
          </div>
          <Badge
            label={currentUser.enabled ? "Linked" : "Disabled"}
            muted={!currentUser.enabled}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Your role" value="Admin" />
          <Metric label="Linked users" value={linkedUserCount} />
        </div>
        <p className="mt-4 text-sm text-[#94a3b8]">
          Admin-only controls are available on this settings page.
        </p>
      </div>
    </div>
  );
}

export function IntegrationSettingsCard({
  label,
  pendingAction,
  settings,
  onChange,
  onSave,
  onTest,
}: {
  label: "Radarr" | "Sonarr";
  pendingAction?: "save" | "test";
  settings: IntegrationSettings;
  onChange: (settings: IntegrationSettings) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  function update<K extends keyof IntegrationSettings>(
    key: K,
    value: IntegrationSettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">{label}</h2>
        <label className="ml-auto flex items-center gap-2 text-xs text-[#94a3b8]">
          Enabled
          <input
            checked={settings.enabled}
            className="h-4 w-4 accent-[#38bdf8]"
            onChange={(event) => update("enabled", event.target.checked)}
            type="checkbox"
          />
        </label>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-[#94a3b8]">URL</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
            onChange={(event) => update("url", event.target.value)}
            placeholder={`http://${label.toLowerCase()}:${
              label === "Radarr" ? "7878" : "8989"
            }`}
            value={settings.url}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#94a3b8]">API key</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
            onChange={(event) => update("apiKey", event.target.value)}
            placeholder={
              settings.apiKeyConfigured
                ? "Configured (leave blank to keep)"
                : "Enter API key"
            }
            type="password"
            value={settings.apiKey ?? ""}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#94a3b8]">Tag name</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
            onChange={(event) => update("tagName", event.target.value)}
            value={settings.tagName}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
          <span className="text-[#94a3b8]">Remove tag when unprotected</span>
          <input
            checked={settings.removeTagsWhenUnprotected}
            className="h-4 w-4 accent-[#38bdf8]"
            onChange={(event) =>
              update("removeTagsWhenUnprotected", event.target.checked)
            }
            type="checkbox"
          />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#334155] px-3 py-2 text-sm hover:bg-[#1f2937] disabled:opacity-50"
          disabled={pendingAction !== undefined}
          onClick={onTest}
          type="button"
        >
          {pendingAction === "test" && (
            <RefreshCw className="animate-spin" size={16} />
          )}
          {pendingAction === "test" ? "Testing" : "Test"}
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-50"
          disabled={pendingAction !== undefined}
          onClick={onSave}
          type="button"
        >
          {pendingAction === "save" && (
            <RefreshCw className="animate-spin" size={16} />
          )}
          {pendingAction === "save" ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

function JobsSettingsPanel({
  activeJob,
  jobsSettings,
  onChange,
  onRunMetadataSync,
  onRunRatingSync,
  onRunTagSync,
  running,
}: {
  activeJob?: SyncJobStatus;
  jobsSettings: JobsSettings;
  onChange: (settings: JobsSettings) => void;
  onRunMetadataSync: () => void;
  onRunRatingSync: () => void;
  onRunTagSync: () => void;
  running: boolean;
}) {
  function updateJob(key: keyof JobsSettings, value: Partial<CronJobSettings>) {
    onChange({
      ...jobsSettings,
      [key]: {
        ...jobsSettings[key],
        ...value,
      },
    });
  }

  return (
    <>
      <JobScheduleCard
        description="Scans selected Plex libraries and updates the local rating cache."
        job={jobsSettings.ratingSync}
        onChange={(value) => updateJob("ratingSync", value)}
        onRun={onRunRatingSync}
        running={running && activeJob?.scope === "full"}
        title="Rating Sync"
      />
      <JobScheduleCard
        description="Reads cached ratings and applies configured Radarr/Sonarr tags."
        job={jobsSettings.tagSync}
        onChange={(value) => updateJob("tagSync", value)}
        onRun={onRunTagSync}
        running={running && activeJob?.scope === "tags"}
        title="Tag Sync"
      />
      <JobScheduleCard
        description="Refreshes cached titles, posters, indexes, and external IDs from Plex without scanning every user's ratings."
        job={jobsSettings.metadataSync}
        onChange={(value) => updateJob("metadataSync", value)}
        onRun={onRunMetadataSync}
        running={running && activeJob?.scope === "metadata"}
        title="Plex Metadata Refresh"
      />
      {running && <SyncProgress job={activeJob} />}
    </>
  );
}

function SyncActionButton({
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

function JobScheduleCard({
  description,
  job,
  onChange,
  onRun,
  running,
  title,
}: {
  description: string;
  job: CronJobSettings;
  onChange: (settings: Partial<CronJobSettings>) => void;
  onRun: () => void;
  running: boolean;
  title: string;
}) {
  const presets: Array<{ value: CronJobSettings["preset"]; label: string }> = [
    { value: "disabled", label: "Disabled" },
    { value: "6h", label: "Every 6 hours" },
    { value: "12h", label: "Every 12 hours" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "custom", label: "Custom cron" },
  ];

  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <RefreshCw size={18} />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-[#94a3b8]">{description}</p>
      <label className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
        <span className="font-medium">Enabled</span>
        <input
          checked={job.enabled}
          className="h-4 w-4 accent-[#38bdf8]"
          onChange={(event) =>
            onChange({
              enabled: event.target.checked,
              preset: event.target.checked
                ? job.preset === "disabled"
                  ? "daily"
                  : job.preset
                : "disabled",
            })
          }
          type="checkbox"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="text-[#94a3b8]">Schedule</span>
        <select
          className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
          onChange={(event) =>
            onChange({
              enabled: event.target.value !== "disabled",
              preset: event.target.value as CronJobSettings["preset"],
            })
          }
          value={job.preset}
        >
          {presets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      {job.preset === "custom" && (
        <label className="mt-3 block text-sm">
          <span className="text-[#94a3b8]">Cron expression</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
            defaultValue={job.cron}
            onBlur={(event) => onChange({ cron: event.target.value })}
            placeholder="0 3 * * *"
          />
        </label>
      )}
      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0ea5e9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-50"
        disabled={running}
        onClick={onRun}
        type="button"
      >
        <RefreshCw className={clsx(running && "animate-spin")} size={17} />
        Run Now
      </button>
    </div>
  );
}

function Badge({ label, muted = false }: { label: string; muted?: boolean }) {
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

function RatingsModal({
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

function SyncProgress({ job }: { job?: SyncJobStatus }) {
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

function PlexPopupLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1120] text-[#e5e7eb]">
      <div className="rounded-md border border-[#263245] bg-[#111827] px-6 py-5 text-center shadow-sm">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#334155] border-t-[#38bdf8]" />
        <h1 className="text-base font-semibold">Opening Plex</h1>
      </div>
    </main>
  );
}

function openCenteredPopup(
  url: string,
  title: string,
  width: number,
  height: number,
): Window | null {
  const dualScreenLeft = window.screenLeft ?? window.screenX;
  const dualScreenTop = window.screenTop ?? window.screenY;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || screen.width;
  const viewportHeight =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    screen.height;
  const left = viewportWidth / 2 - width / 2 + dualScreenLeft;
  const top = viewportHeight / 2 - height / 2 + dualScreenTop;

  const popup = window.open(
    url,
    title,
    `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`,
  );

  popup?.focus();
  return popup;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-[#172033] px-3 py-2">
      <p className="text-xs text-[#94a3b8]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
