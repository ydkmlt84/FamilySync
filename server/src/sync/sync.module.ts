import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PlexModule } from "../plex/plex.module";
import { UsersModule } from "../users/users.module";
import { RatingsModule } from "../ratings/ratings.module";
import { SettingsModule } from "../settings/settings.module";
import { RadarrModule } from "../radarr/radarr.module";
import { SonarrModule } from "../sonarr/sonarr.module";
import { SyncController } from "./sync.controller";
import { SyncSchedulerService } from "./sync-scheduler.service";
import { SyncService } from "./sync.service";

@Module({
  imports: [
    PlexModule,
    UsersModule,
    RatingsModule,
    SettingsModule,
    RadarrModule,
    SonarrModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncSchedulerService],
})
export class SyncModule {}
