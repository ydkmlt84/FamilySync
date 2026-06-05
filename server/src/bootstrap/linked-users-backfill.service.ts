import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { PlexService } from "../plex/plex.service";
import {
  PLEX_SERVER_IDENTIFIER_SETTING,
  SettingsService,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class LinkedUsersBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LinkedUsersBackfillService.name);

  constructor(
    @Inject(PlexService) private readonly plex: PlexService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.settings.get(PLEX_SERVER_IDENTIFIER_SETTING))) {
      await this.persistServerFromExistingAdmin();
    }

    if (!(await this.settings.get(PLEX_SERVER_IDENTIFIER_SETTING))) {
      return;
    }

    await this.backfillLinkedUserServerTokens();
  }

  private async persistServerFromExistingAdmin(): Promise<void> {
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin?.plexAccountToken) {
      return;
    }

    try {
      const server = await this.plex.bootstrapServerSelectionFromAdminToken(
        admin.plexAccountToken,
      );
      await this.users.updateServerSelection(admin, {
        plexToken: server.accessToken,
        plexServerIdentifier: server.clientIdentifier,
        plexServerName: server.name,
      });
      this.logger.log(
        `Backfilled selected Plex server from existing admin ${admin.plexUsername}.`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not backfill selected Plex server from existing admin: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async backfillLinkedUserServerTokens(): Promise<void> {
    const linkedUsers = await this.users.list();

    for (const user of linkedUsers) {
      if (!user.plexAccountToken) {
        continue;
      }

      if (user.plexServerIdentifier) {
        continue;
      }

      try {
        const server = await this.plex.resolveConfiguredServerToken(
          user.plexAccountToken,
        );
        await this.users.updateServerSelection(user, {
          plexToken: server.accessToken,
          plexServerIdentifier: server.clientIdentifier,
          plexServerName: server.name,
        });
        this.logger.log(
          `Backfilled Plex server token for ${user.plexUsername}.`,
        );
      } catch (error) {
        this.logger.warn(
          `Could not backfill Plex server token for ${user.plexUsername}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
