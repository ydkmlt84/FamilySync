import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlexModule } from "../plex/plex.module";
import { UsersModule } from "../users/users.module";
import { SettingsModule } from "../settings/settings.module";
import { UserRating } from "./user-rating.entity";
import { MediaOverride } from "./media-override.entity";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";
import { RadarrModule } from "../radarr/radarr.module";
import { SonarrModule } from "../sonarr/sonarr.module";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserRating, MediaOverride]),
    PlexModule,
    UsersModule,
    RadarrModule,
    SonarrModule,
    SettingsModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
