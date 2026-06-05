import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServeStaticModule } from "@nestjs/serve-static";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { LinkedUser } from "./users/linked-user.entity";
import { UserRating } from "./ratings/user-rating.entity";
import { MediaOverride } from "./ratings/media-override.entity";
import { AppSetting } from "./settings/app-setting.entity";
import { UserSession } from "./auth/user-session.entity";
import { PlexModule } from "./plex/plex.module";
import { UsersModule } from "./users/users.module";
import { RatingsModule } from "./ratings/ratings.module";
import { SyncModule } from "./sync/sync.module";
import { AuthModule } from "./auth/auth.module";
import { RadarrModule } from "./radarr/radarr.module";
import { SonarrModule } from "./sonarr/sonarr.module";
import { SettingsModule } from "./settings/settings.module";
import { appConfig } from "./config/app.config";
import { LinkedUsersBackfillService } from "./bootstrap/linked-users-backfill.service";
import { SecurityModule } from "./security/security.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "dist/web"),
      exclude: ["/api*"],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<string>("databasePath");
        mkdirSync(dirname(database), { recursive: true });

        return {
          type: "better-sqlite3",
          database,
          entities: [
            LinkedUser,
            UserRating,
            MediaOverride,
            AppSetting,
            UserSession,
          ],
          synchronize: true,
        };
      },
    }),
    PlexModule,
    UsersModule,
    RatingsModule,
    SyncModule,
    AuthModule,
    RadarrModule,
    SonarrModule,
    SettingsModule,
    SecurityModule,
  ],
  providers: [LinkedUsersBackfillService],
})
export class AppModule {}
