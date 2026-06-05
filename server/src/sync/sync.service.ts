import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { CronJob } from "cron";
import { PlexService } from "../plex/plex.service";
import { RatingsService } from "../ratings/ratings.service";
import {
  PLEX_SELECTED_MOVIE_LIBRARY_KEYS_SETTING,
  PLEX_SELECTED_TV_LIBRARY_KEYS_SETTING,
  METADATA_SYNC_JOB_SETTING,
  RATING_SYNC_JOB_SETTING,
  SettingsService,
  TAG_SYNC_JOB_SETTING,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";

export type SyncJobStatus = {
  id: string;
  label: string;
  scope: "full" | "user" | "tags" | "metadata";
  status: "running" | "completed" | "failed";
  totalMovies: number;
  processedMovies: number;
  syncedMovies: number;
  skippedMovies: number;
  cachedSkips: number;
  users: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
};

export type CronPreset =
  | "disabled"
  | "6h"
  | "12h"
  | "daily"
  | "weekly"
  | "custom";

export type CronJobSettings = {
  enabled: boolean;
  preset: CronPreset;
  cron: string;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly jobs = new Map<string, SyncJobStatus>();
  private readonly recentScanMaxAgeMs = 24 * 60 * 60 * 1000;

  constructor(
    @Inject(PlexService)
    private readonly plex: PlexService,
    @Inject(RatingsService)
    private readonly ratings: RatingsService,
    @Inject(UsersService)
    private readonly users: UsersService,
    @Inject(SettingsService)
    private readonly settings: SettingsService,
  ) {}

  startFullSync(): SyncJobStatus {
    return this.startJob("Full library sync", "full", (job) =>
      this.runFullSync(job),
    );
  }

  startUserSync(userId: string): SyncJobStatus {
    return this.startJob("User rating sync", "user", (job) =>
      this.runUserSync(job, userId),
    );
  }

  startTagSync(): SyncJobStatus {
    return this.startJob("Tag sync", "tags", (job) => this.runTagSync(job));
  }

  startMetadataSync(): SyncJobStatus {
    const running = [...this.jobs.values()].find(
      (job) => job.scope === "metadata" && job.status === "running",
    );
    return (
      running ??
      this.startJob("Plex metadata refresh", "metadata", (job) =>
        this.runMetadataSync(job),
      )
    );
  }

  getJob(id: string): SyncJobStatus | undefined {
    return this.jobs.get(id);
  }

  private startJob(
    label: string,
    scope: SyncJobStatus["scope"],
    runner: (job: SyncJobStatus) => Promise<void>,
  ): SyncJobStatus {
    const job: SyncJobStatus = {
      id: crypto.randomUUID(),
      label,
      scope,
      status: "running",
      totalMovies: 0,
      processedMovies: 0,
      syncedMovies: 0,
      skippedMovies: 0,
      cachedSkips: 0,
      users: 0,
      startedAt: new Date(),
    };

    this.jobs.set(job.id, job);
    void runner(job).catch((error) => {
      job.status = "failed";
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync job ${job.id} failed: ${job.error}`);
    });
    return job;
  }

  private async runFullSync(job: SyncJobStatus): Promise<void> {
    const linkedUsers = await this.users.listEnabled();

    if (linkedUsers.length === 0) {
      this.logger.log("Full sync skipped: no enabled linked users.");
      this.completeJob(job);
      return;
    }

    job.users = linkedUsers.length;
    const sourceUser =
      linkedUsers.find((user) => user.isAdmin) ?? linkedUsers[0];
    this.logger.log(
      `Full sync started using ${sourceUser.plexUsername}; users=${linkedUsers.length}.`,
    );
    const selectedLibraryKeys = await this.getSelectedMovieLibraryKeys();
    const selectedTvLibraryKeys = await this.getSelectedTvLibraryKeys();
    const ratingKeys = await this.plex.listMediaRatingKeys(
      sourceUser.plexToken,
      {
        movieLibraryKeys: selectedLibraryKeys,
        tvLibraryKeys: selectedTvLibraryKeys,
      },
    );
    const debug = await this.ratings.isDebugLogging();
    job.totalMovies = ratingKeys.length;
    this.logger.log(`Full sync discovered ${ratingKeys.length} media items.`);

    for (const ratingKey of ratingKeys) {
      try {
        if (
          await this.ratings.hasFreshCacheForAllUsers(
            ratingKey,
            linkedUsers,
            this.recentScanMaxAgeMs,
          )
        ) {
          job.cachedSkips += 1;
          if (debug) {
            this.logger.debug(
              `Full sync skipped ${ratingKey}: all enabled users scanned recently.`,
            );
          }
          continue;
        }

        await this.ratings.aggregate(ratingKey);
        job.syncedMovies += 1;
      } catch (error) {
        job.skippedMovies += 1;
        this.logger.warn(
          `Skipped Plex ratingKey ${ratingKey} during sync: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        job.processedMovies += 1;
      }
    }

    for (const user of linkedUsers) {
      await this.users.markSynced(user);
    }

    this.logger.log(
      `Full sync completed: syncedMovies=${job.syncedMovies}, cachedSkips=${job.cachedSkips}, skippedMovies=${job.skippedMovies}, users=${linkedUsers.length}.`,
    );
    this.completeJob(job);
  }

  private async runUserSync(job: SyncJobStatus, userId: string): Promise<void> {
    const linkedUsers = await this.users.listEnabled();
    const user = await this.users.findById(userId);
    job.label = `${user.plexUsername} rating sync`;
    job.users = 1;

    if (!user.enabled) {
      this.logger.log(
        `User sync skipped for ${user.plexUsername}: user is disabled.`,
      );
      this.completeJob(job);
      return;
    }

    const sourceUser =
      linkedUsers.find((linkedUser) => linkedUser.isAdmin) ?? user;
    this.logger.log(
      `User sync started for ${user.plexUsername} using library source ${sourceUser.plexUsername}.`,
    );
    const selectedLibraryKeys = await this.getSelectedMovieLibraryKeys();
    const selectedTvLibraryKeys = await this.getSelectedTvLibraryKeys();
    const ratingKeys = await this.plex.listMediaRatingKeys(
      sourceUser.plexToken,
      {
        movieLibraryKeys: selectedLibraryKeys,
        tvLibraryKeys: selectedTvLibraryKeys,
      },
    );
    const debug = await this.ratings.isDebugLogging();
    job.totalMovies = ratingKeys.length;
    this.logger.log(
      `User sync for ${user.plexUsername} discovered ${ratingKeys.length} media items.`,
    );

    for (const ratingKey of ratingKeys) {
      try {
        if (
          await this.ratings.hasFreshCacheForUser(
            ratingKey,
            user,
            this.recentScanMaxAgeMs,
          )
        ) {
          job.cachedSkips += 1;
          if (debug) {
            this.logger.debug(
              `User sync skipped ${ratingKey} for ${user.plexUsername}: scanned recently.`,
            );
          }
          continue;
        }

        await this.ratings.fetchAndCacheUserRating(ratingKey, user);
        job.syncedMovies += 1;
      } catch {
        await this.ratings.cacheUnavailableRating(ratingKey, user);
        job.skippedMovies += 1;
        if (debug) {
          this.logger.debug(
            `User sync failed to retrieve ${ratingKey} for ${user.plexUsername}.`,
          );
        }
      } finally {
        job.processedMovies += 1;
      }
    }

    await this.users.markSynced(user);
    this.logger.log(
      `User sync completed for ${user.plexUsername}: syncedMovies=${job.syncedMovies}, cachedSkips=${job.cachedSkips}, syncErrors=${job.skippedMovies}.`,
    );
    this.completeJob(job);
  }

  private completeJob(job: SyncJobStatus): void {
    job.status = "completed";
    job.completedAt = new Date();
  }

  private async runTagSync(job: SyncJobStatus): Promise<void> {
    this.logger.log("Tag sync started.");
    const result = await this.ratings.syncTagsFromCache();
    job.totalMovies = result.processedMedia + result.skippedMedia;
    job.processedMovies = job.totalMovies;
    job.syncedMovies = result.taggedMedia;
    job.skippedMovies = result.skippedMedia;
    if (result.message) {
      job.error = result.message;
    }
    this.logger.log(
      `Tag sync completed: processedMedia=${result.processedMedia}, taggedMedia=${result.taggedMedia}, skippedMedia=${result.skippedMedia}.`,
    );
    this.completeJob(job);
  }

  private async runMetadataSync(job: SyncJobStatus): Promise<void> {
    const linkedUsers = await this.users.listEnabled();
    const sourceUser =
      linkedUsers.find((user) => user.isAdmin) ?? linkedUsers[0];

    if (!sourceUser) {
      this.logger.log("Metadata refresh skipped: no enabled linked users.");
      this.completeJob(job);
      return;
    }

    job.users = 1;
    const selectedRatingKeys = await this.plex.listMediaRatingKeys(
      sourceUser.plexToken,
      {
        movieLibraryKeys: await this.getSelectedMovieLibraryKeys(),
        tvLibraryKeys: await this.getSelectedTvLibraryKeys(),
      },
    );
    await this.ratings.pruneToRatingKeys(selectedRatingKeys);
    const selectedKeySet = new Set(selectedRatingKeys);
    const cachedRatingKeys = (await this.ratings.listCachedRatingKeys()).filter(
      (ratingKey) => selectedKeySet.has(ratingKey),
    );
    job.totalMovies = cachedRatingKeys.length;
    this.logger.log(
      `Metadata refresh started for ${cachedRatingKeys.length} cached media items.`,
    );

    for (const ratingKey of cachedRatingKeys) {
      try {
        if (await this.ratings.refreshCachedMetadata(ratingKey, sourceUser)) {
          job.syncedMovies += 1;
        } else {
          job.skippedMovies += 1;
        }
      } catch (error) {
        job.skippedMovies += 1;
        this.logger.warn(
          `Metadata refresh skipped Plex ratingKey ${ratingKey}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        job.processedMovies += 1;
      }
    }

    this.logger.log(
      `Metadata refresh completed: refreshed=${job.syncedMovies}, skipped=${job.skippedMovies}.`,
    );
    this.completeJob(job);
  }

  async getJobSettings(): Promise<{
    ratingSync: CronJobSettings;
    tagSync: CronJobSettings;
    metadataSync: CronJobSettings;
  }> {
    return {
      ratingSync: await this.settings.getJson<CronJobSettings>(
        RATING_SYNC_JOB_SETTING,
        this.defaultCronSettings(),
      ),
      tagSync: await this.settings.getJson<CronJobSettings>(
        TAG_SYNC_JOB_SETTING,
        this.defaultCronSettings(),
      ),
      metadataSync: await this.settings.getJson<CronJobSettings>(
        METADATA_SYNC_JOB_SETTING,
        this.defaultMetadataCronSettings(),
      ),
    };
  }

  async setJobSettings(settings: {
    ratingSync?: Partial<CronJobSettings>;
    tagSync?: Partial<CronJobSettings>;
    metadataSync?: Partial<CronJobSettings>;
  }): Promise<{
    ratingSync: CronJobSettings;
    tagSync: CronJobSettings;
    metadataSync: CronJobSettings;
  }> {
    const current = await this.getJobSettings();

    if (settings.ratingSync) {
      const next = this.normalizeCronSettings(
        settings.ratingSync,
        current.ratingSync,
      );
      this.assertValidCronSettings(next);
      await this.settings.setJson(RATING_SYNC_JOB_SETTING, next);
    }

    if (settings.tagSync) {
      const next = this.normalizeCronSettings(
        settings.tagSync,
        current.tagSync,
      );
      this.assertValidCronSettings(next);
      await this.settings.setJson(TAG_SYNC_JOB_SETTING, next);
    }

    if (settings.metadataSync) {
      const next = this.normalizeCronSettings(
        settings.metadataSync,
        current.metadataSync,
      );
      this.assertValidCronSettings(next);
      await this.settings.setJson(METADATA_SYNC_JOB_SETTING, next);
    }

    return this.getJobSettings();
  }

  getSelectedMovieLibraryKeys(): Promise<string[]> {
    return this.settings.getJson<string[]>(
      PLEX_SELECTED_MOVIE_LIBRARY_KEYS_SETTING,
      [],
    );
  }

  getSelectedTvLibraryKeys(): Promise<string[]> {
    return this.settings.getJson<string[]>(
      PLEX_SELECTED_TV_LIBRARY_KEYS_SETTING,
      [],
    );
  }

  async setSelectedMovieLibraryKeys(keys: string[]): Promise<string[]> {
    const normalizedKeys = [...new Set(keys.map(String).filter(Boolean))];
    await this.settings.setJson(
      PLEX_SELECTED_MOVIE_LIBRARY_KEYS_SETTING,
      normalizedKeys,
    );
    return normalizedKeys;
  }

  async setSelectedTvLibraryKeys(keys: string[]): Promise<string[]> {
    const normalizedKeys = [...new Set(keys.map(String).filter(Boolean))];
    await this.settings.setJson(
      PLEX_SELECTED_TV_LIBRARY_KEYS_SETTING,
      normalizedKeys,
    );
    return normalizedKeys;
  }

  async refreshLibraryData() {
    const linkedUsers = await this.users.listEnabled();
    const sourceUser =
      linkedUsers.find((user) => user.isAdmin) ?? linkedUsers[0];
    const selectedKeys = await this.getSelectedMovieLibraryKeys();
    const selectedTvKeys = await this.getSelectedTvLibraryKeys();

    if (sourceUser && (selectedKeys.length > 0 || selectedTvKeys.length > 0)) {
      const selectedRatingKeys = await this.plex.listMediaRatingKeys(
        sourceUser.plexToken,
        {
          movieLibraryKeys: selectedKeys,
          tvLibraryKeys: selectedTvKeys,
        },
      );
      await this.ratings.pruneToRatingKeys(selectedRatingKeys);
    }

    return this.ratings.getStats();
  }

  async listMovieLibraries(): Promise<{
    libraries: Array<{
      key: string;
      title: string;
      count?: number;
      selected: boolean;
    }>;
    selectedKeys: string[];
  }> {
    const linkedUsers = await this.users.listEnabled();
    const sourceUser =
      linkedUsers.find((user) => user.isAdmin) ?? linkedUsers[0];

    if (!sourceUser) {
      return { libraries: [], selectedKeys: [] };
    }

    const selectedKeys = await this.getSelectedMovieLibraryKeys();
    const selectedKeySet = new Set(selectedKeys);
    const libraries = await this.plex.listMovieLibraries(sourceUser.plexToken);

    return {
      libraries: libraries.map((library) => ({
        ...library,
        selected: selectedKeySet.size === 0 || selectedKeySet.has(library.key),
      })),
      selectedKeys,
    };
  }

  async listTvLibraries(): Promise<{
    libraries: Array<{
      key: string;
      title: string;
      count?: number;
      selected: boolean;
    }>;
    selectedKeys: string[];
  }> {
    const linkedUsers = await this.users.listEnabled();
    const sourceUser =
      linkedUsers.find((user) => user.isAdmin) ?? linkedUsers[0];

    if (!sourceUser) {
      return { libraries: [], selectedKeys: [] };
    }

    const selectedKeys = await this.getSelectedTvLibraryKeys();
    const selectedKeySet = new Set(selectedKeys);
    const libraries = (
      await this.plex.listLibraries(sourceUser.plexToken)
    ).filter((library) => library.type === "show");

    return {
      libraries: libraries.map((library) => ({
        ...library,
        selected: selectedKeySet.size === 0 || selectedKeySet.has(library.key),
      })),
      selectedKeys,
    };
  }

  cronExpression(settings: CronJobSettings): string | undefined {
    if (!settings.enabled || settings.preset === "disabled") {
      return undefined;
    }

    if (settings.preset === "6h") {
      return "0 */6 * * *";
    }

    if (settings.preset === "12h") {
      return "0 */12 * * *";
    }

    if (settings.preset === "daily") {
      return "0 3 * * *";
    }

    if (settings.preset === "weekly") {
      return "0 4 * * 0";
    }

    return settings.cron.trim() || undefined;
  }

  private defaultCronSettings(): CronJobSettings {
    return {
      enabled: false,
      preset: "disabled",
      cron: "0 3 * * *",
    };
  }

  private defaultMetadataCronSettings(): CronJobSettings {
    return {
      enabled: true,
      preset: "weekly",
      cron: "0 4 * * 0",
    };
  }

  private normalizeCronSettings(
    settings: Partial<CronJobSettings>,
    current: CronJobSettings,
  ): CronJobSettings {
    const preset = settings.preset ?? current.preset;

    return {
      enabled: Boolean(settings.enabled),
      preset,
      cron: settings.cron?.trim() || current.cron || "0 3 * * *",
    };
  }

  private assertValidCronSettings(settings: CronJobSettings): void {
    const expression = this.cronExpression(settings);

    if (!expression) {
      return;
    }

    try {
      const job = new CronJob(expression, () => undefined);
      job.stop();
    } catch {
      throw new BadRequestException(`Invalid cron expression: ${expression}`);
    }
  }
}
