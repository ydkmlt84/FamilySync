import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlexModule } from "../plex/plex.module";
import { AppSetting } from "./app-setting.entity";
import { SettingsSeedService } from "./settings-seed.service";
import { SettingsService } from "./settings.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting]),
    forwardRef(() => PlexModule),
  ],
  providers: [SettingsService, SettingsSeedService],
  exports: [SettingsService],
})
export class SettingsModule {}
