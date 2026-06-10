import { useCallback, useEffect, useRef, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { clsx } from "clsx";
import {
  AggregatedRating,
  api,
  FavoriteMovieRating,
  IntegrationSettings,
  LinkedUser,
  LowRatedSettings,
  ManagedHomeUser,
  MediaSearchResult,
  MovieRatingDetails,
  MovieLibrarySelection,
  JobsSettings,
  PublicCarouselRating,
  ProtectedTagSettings,
  SyncJobStatus,
  SyncStats,
} from "./api";
import { LandingHero } from "./components/FavoritesCarousel";
import {
  ExcludedMediaModal,
  filterMediaByType,
  PosterGrid,
  RatingsModal,
} from "./components/Media";
import {
  LibraryDataCard,
  LoggingCard,
  RatingLookupCard,
  SyncPanel,
} from "./components/Overview";
import { LogoMark, PlexPopupLoading, UserArea } from "./components/Primitives";
import {
  AdminConnectionCard,
  IntegrationSettingsCard,
  JobsSettingsPanel,
  LibrarySettingsCard,
  SettingsTabs,
  TagSettingsPanel,
  UsersSettingsPanel,
} from "./components/Settings";
import { openCenteredPopup } from "./popup";
import { SetupWizard } from "./SetupWizard";
import type { MediaFilter, SettingsTab } from "./types";

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
  const [carouselRaters, setCarouselRaters] = useState<string[]>([]);
  const [carouselRatersLoading, setCarouselRatersLoading] = useState(false);
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
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [mediaSearchResults, setMediaSearchResults] = useState<
    MediaSearchResult[]
  >([]);
  const [mediaSearchPending, setMediaSearchPending] = useState(false);
  const [rating, setRating] = useState<AggregatedRating>();
  const [selectedMovie, setSelectedMovie] = useState<MovieRatingDetails>();
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [page, setPage] = useState<"home" | "settings">("home");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("overview");
  const [plexAuthPending, setPlexAuthPending] = useState(false);
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
    }, 8000);

    return () => window.clearInterval(interval);
  }, [carouselMovies.length]);

  useEffect(() => {
    setFavoriteIndex(0);
  }, [carouselMovies.length]);

  useEffect(() => {
    const query = mediaSearchQuery.trim();

    if (!currentUser?.isAdmin || query.length < 2) {
      setMediaSearchResults([]);
      setMediaSearchPending(false);
      return;
    }

    let cancelled = false;
    setMediaSearchPending(true);
    const timeout = window.setTimeout(() => {
      void api
        .searchMedia(query)
        .then((results) => {
          if (!cancelled) {
            setMediaSearchResults(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMediaSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setMediaSearchPending(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [currentUser?.isAdmin, mediaSearchQuery]);

  useEffect(() => {
    const ratingKey = carouselMovies[favoriteIndex]?.ratingKey;

    if (!currentUser?.isAdmin || !ratingKey) {
      setCarouselRaters([]);
      setCarouselRatersLoading(false);
      return;
    }

    let cancelled = false;
    setCarouselRatersLoading(true);

    void api
      .getCarouselRaters(ratingKey)
      .then((result) => {
        if (!cancelled) {
          setCarouselRaters(result.names);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCarouselRaters([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCarouselRatersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [carouselMovies, currentUser?.isAdmin, favoriteIndex]);

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
          const username = result.user?.plexUsername ?? "Plex user";
          showToast(
            result.action === "signed-in"
              ? `Signed in as ${username}.`
              : `Linked ${username}.`,
          );
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
        busy={plexAuthPending}
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
        setJobsSettings(await api.getJobsSettings());

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
    setPlexAuthPending(true);
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
      setPlexAuthPending(false);
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

  async function queryRating(result: MediaSearchResult) {
    setMediaSearchQuery(result.title);
    setMediaSearchResults([]);
    setRatingLookupPending(true);
    try {
      setRating(await api.getRating(result.ratingKey));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setRatingLookupPending(false);
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
        busy={plexAuthPending}
        currentUser={currentUser}
        favoriteIndex={favoriteIndex}
        favorites={carouselMovies}
        onJoin={joinWithPlex}
        raters={carouselRaters}
        ratersLoading={carouselRatersLoading}
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
              {settingsTab === "overview" && currentUser?.isAdmin && (
                <SyncPanel
                  activeJob={activeSyncJob}
                  onMetadataSync={forceMetadataSync}
                  onRatingSync={forceSync}
                  onTagSync={forceTagSync}
                  syncing={syncing}
                />
              )}{" "}
              {settingsTab === "users" && currentUser && (
                <UsersSettingsPanel
                  currentUser={currentUser}
                  importingManagedUserId={importingManagedUserId}
                  managedHomePins={managedHomePins}
                  managedHomeUsers={managedHomeUsers}
                  onImportManagedUser={importManagedHomeUser}
                  onManagedHomePinChange={(userId, pin) =>
                    setManagedHomePins((current) => ({
                      ...current,
                      [userId]: pin,
                    }))
                  }
                  onRefreshManagedUsers={refreshManagedHomeUsers}
                  onRefreshUsers={refreshLinkedUsers}
                  onRemoveUser={removeUser}
                  onSyncUser={syncUser}
                  onToggleUser={toggleUser}
                  pendingUserAction={pendingUserAction}
                  refreshingManagedUsers={refreshingManagedUsers}
                  refreshingUsers={refreshingUsers}
                  syncingUserId={syncingUserId}
                  users={users}
                />
              )}{" "}
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
                <LibrarySettingsCard
                  description="Selected movie libraries are used by full sync and individual user sync."
                  emptyMessage="No Plex movie libraries found."
                  itemLabel="items"
                  libraries={movieLibraries}
                  onToggle={toggleMovieLibrary}
                  title="Movie Libraries"
                />
              )}
              {settingsTab === "libraries" && currentUser?.isAdmin && (
                <LibrarySettingsCard
                  description="TV sync includes show, season, and episode rating keys from selected TV libraries."
                  emptyMessage="No Plex TV libraries found."
                  itemLabel="shows"
                  libraries={tvLibraries}
                  onToggle={toggleTvLibrary}
                  title="TV Libraries"
                />
              )}
              {settingsTab === "protection" && currentUser?.isAdmin && (
                <TagSettingsPanel
                  lowRatedSettings={lowRatedSettings}
                  onLowRatedChange={saveLowRatedSettings}
                  onProtectedTagChange={saveProtectedTagSettings}
                  onProtectionThresholdChange={saveProtectionThreshold}
                  protectedTagSettings={protectedTagSettings}
                  protectionThreshold={protectionThreshold}
                />
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
                <RatingLookupCard
                  loadingRating={ratingLookupPending}
                  onChange={(query) => {
                    setMediaSearchQuery(query);
                    setRating(undefined);
                  }}
                  onSelect={queryRating}
                  query={mediaSearchQuery}
                  rating={rating}
                  results={mediaSearchResults}
                  searching={mediaSearchPending}
                />
              )}
              {settingsTab === "overview" && currentUser?.isAdmin && (
                <LibraryDataCard
                  onRefresh={refreshLibraryData}
                  refreshing={refreshingLibraryData}
                  stats={syncStats}
                />
              )}
              {settingsTab === "overview" && currentUser?.isAdmin && (
                <LoggingCard logLevel={logLevel} onChange={saveLogLevel} />
              )}{" "}
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

export {
  ExcludedMediaModal,
  filterMediaByType,
  formatSyncStatus,
  MediaTypeBadge,
  PosterGrid,
  supportsTagExclusion,
} from "./components/Media";
export { LogoMark } from "./components/Primitives";
export { IntegrationSettingsCard } from "./components/Settings";
