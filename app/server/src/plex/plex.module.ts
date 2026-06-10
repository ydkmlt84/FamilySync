import { forwardRef, Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { PlexService } from "./plex.service";

@Module({
  imports: [forwardRef(() => SettingsModule)],
  providers: [PlexService],
  exports: [PlexService],
})
export class PlexModule {}
