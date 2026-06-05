import {
  Controller,
  Body,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { RatingsService } from "../ratings/ratings.service";
import { RadarrService } from "../radarr/radarr.service";
import { SonarrService } from "../sonarr/sonarr.service";
import {
  IntegrationSettingsDto,
  JobsSettingsDto,
  SyncSettingsDto,
  toIntegrationSettingsResponse,
} from "./integration-settings.dto";
import { SyncSchedulerService } from "./sync-scheduler.service";
import { SyncService } from "./sync.service";

@Controller("sync")
@UseGuards(AuthGuard, AdminGuard)
export class SyncController {
  constructor(
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(RadarrService) private readonly radarr: RadarrService,
    @Inject(SonarrService) private readonly sonarr: SonarrService,
    @Inject(SyncSchedulerService)
    private readonly scheduler: SyncSchedulerService,
  ) {}

  @Get("stats")
  stats() {
    return this.ratings.getStats();
  }

  @Post("stats/refresh")
  refreshStats() {
    return this.sync.refreshLibraryData();
  }

  @Get("settings")
  async settings() {
    return {
      protectionThreshold: await this.ratings.getProtectionThreshold(),
      taggingEnabled: await this.ratings.getTaggingEnabled(),
      logLevel: await this.ratings.getLogLevel(),
      protectedTag: await this.ratings.getProtectedTagSettings(),
      lowRated: await this.ratings.getLowRatedSettings(),
      radarr: toIntegrationSettingsResponse(await this.radarr.getSettings()),
      sonarr: toIntegrationSettingsResponse(await this.sonarr.getSettings()),
    };
  }

  @Post("settings")
  async updateSettings(
    @Body()
    body: SyncSettingsDto,
  ) {
    if (body.radarr) {
      await this.radarr.updateSettings(body.radarr);
    }

    if (body.sonarr) {
      await this.sonarr.updateSettings(body.sonarr);
    }

    if (body.taggingEnabled !== undefined) {
      await this.ratings.setTaggingEnabled(body.taggingEnabled);
    }

    if (body.protectionThreshold !== undefined) {
      await this.ratings.setProtectionThreshold(
        Number(body.protectionThreshold),
      );
    }

    if (body.logLevel !== undefined) {
      await this.ratings.setLogLevel(body.logLevel);
    }

    if (body.lowRated) {
      await this.ratings.setLowRatedSettings(body.lowRated);
    }

    if (body.protectedTag) {
      await this.ratings.setProtectedTagSettings(body.protectedTag);
    }

    return {
      protectionThreshold: await this.ratings.getProtectionThreshold(),
      taggingEnabled: await this.ratings.getTaggingEnabled(),
      logLevel: await this.ratings.getLogLevel(),
      protectedTag: await this.ratings.getProtectedTagSettings(),
      lowRated: await this.ratings.getLowRatedSettings(),
      radarr: toIntegrationSettingsResponse(await this.radarr.getSettings()),
      sonarr: toIntegrationSettingsResponse(await this.sonarr.getSettings()),
    };
  }

  @Post("settings/radarr/test")
  testRadarr(@Body() body: IntegrationSettingsDto) {
    return this.radarr.testConnection(body);
  }

  @Post("settings/sonarr/test")
  testSonarr(@Body() body: IntegrationSettingsDto) {
    return this.sonarr.testConnection(body);
  }

  @Get("jobs/settings")
  jobSettings() {
    return this.sync.getJobSettings();
  }

  @Post("jobs/settings")
  async updateJobSettings(@Body() body: JobsSettingsDto) {
    const settings = await this.sync.setJobSettings(body);
    await this.scheduler.refresh();
    return settings;
  }

  @Get("libraries")
  libraries() {
    return this.sync.listMovieLibraries();
  }

  @Get("libraries/tv")
  tvLibraries() {
    return this.sync.listTvLibraries();
  }

  @Post("libraries")
  updateLibraries(@Body() body: { selectedKeys?: string[] }) {
    return this.sync.setSelectedMovieLibraryKeys(body.selectedKeys ?? []);
  }

  @Post("libraries/tv")
  updateTvLibraries(@Body() body: { selectedKeys?: string[] }) {
    return this.sync.setSelectedTvLibraryKeys(body.selectedKeys ?? []);
  }

  @Post()
  forceSync() {
    return this.sync.startFullSync();
  }

  @Post("tags")
  syncTags() {
    return this.sync.startTagSync();
  }

  @Post("metadata")
  syncMetadata() {
    return this.sync.startMetadataSync();
  }

  @Post("users/:id")
  syncUser(@Param("id") id: string) {
    return this.sync.startUserSync(id);
  }

  @Get("jobs/:id")
  syncJob(@Param("id") id: string) {
    const job = this.sync.getJob(id);

    if (!job) {
      throw new NotFoundException("Sync job not found.");
    }

    return job;
  }
}
