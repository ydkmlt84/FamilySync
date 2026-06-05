import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PLEX_SERVER_IDENTIFIER_SETTING,
  PLEX_SERVER_NAME_SETTING,
  SettingsService,
} from "./settings.service";

@Injectable()
export class SettingsSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsSeedService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const configuredIdentifier = this.config.get<string>(
      "plex.serverClientIdentifier",
    );
    const configuredName = this.config.get<string>("plex.serverName");

    if (
      configuredIdentifier &&
      !(await this.settings.get(PLEX_SERVER_IDENTIFIER_SETTING))
    ) {
      await this.settings.set(
        PLEX_SERVER_IDENTIFIER_SETTING,
        configuredIdentifier,
      );
      this.logger.log(
        "Seeded Plex server identifier from PLEX_SERVER_IDENTIFIER.",
      );
    }

    if (
      configuredName &&
      !(await this.settings.get(PLEX_SERVER_NAME_SETTING))
    ) {
      await this.settings.set(PLEX_SERVER_NAME_SETTING, configuredName);
    }
  }
}
