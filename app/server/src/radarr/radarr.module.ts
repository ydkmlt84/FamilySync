import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { RadarrService } from "./radarr.service";

@Module({
  imports: [SettingsModule],
  providers: [RadarrService],
  exports: [RadarrService],
})
export class RadarrModule {}
