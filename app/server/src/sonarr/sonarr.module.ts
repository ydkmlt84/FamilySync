import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { SonarrService } from "./sonarr.service";

@Module({
  imports: [SettingsModule],
  providers: [SonarrService],
  exports: [SonarrService],
})
export class SonarrModule {}
