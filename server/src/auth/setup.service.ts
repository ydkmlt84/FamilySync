import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PlexService } from "../plex/plex.service";
import {
  PLEX_BASE_URL_SETTING,
  SETUP_COMPLETED_SETTING,
  SettingsService,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";

export type SetupStatus = {
  setupRequired: boolean;
  needsFirstAdmin: boolean;
  serverConfigured: boolean;
};

@Injectable()
export class SetupService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(PlexService) private readonly plex: PlexService,
  ) {}

  async status(): Promise<SetupStatus> {
    const completed =
      (await this.settings.get(SETUP_COMPLETED_SETTING)) === "true";
    const hasAdmin = await this.hasAdmin();
    const serverConfigured = await this.isServerConfigured();
    const ready = completed || (hasAdmin && serverConfigured);

    if (ready && !completed) {
      await this.settings.set(SETUP_COMPLETED_SETTING, "true");
    }

    return {
      setupRequired: !ready,
      needsFirstAdmin: !hasAdmin,
      serverConfigured,
    };
  }

  async needsFirstAdmin(): Promise<boolean> {
    return !(await this.hasAdmin());
  }

  async completeServerSetup(): Promise<void> {
    if ((await this.hasAdmin()) && (await this.isServerConfigured())) {
      await this.settings.set(SETUP_COMPLETED_SETTING, "true");
    }
  }

  async listServerCandidates() {
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin?.plexAccountToken) {
      throw new ServiceUnavailableException(
        "No linked admin account is available to query Plex.",
      );
    }

    return this.plex.listServerConnections(admin.plexAccountToken);
  }

  async testServerConnection(uri: string) {
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin?.plexToken) {
      throw new ServiceUnavailableException(
        "No linked admin account is available to test the connection.",
      );
    }

    return this.plex.testServerBaseUrl(uri, admin.plexToken);
  }

  async saveServerBaseUrl(baseUrl: string): Promise<SetupStatus> {
    const normalized = baseUrl.replace(/\/+$/, "");
    await this.settings.set(PLEX_BASE_URL_SETTING, normalized);
    await this.completeServerSetup();
    return this.status();
  }

  private async hasAdmin(): Promise<boolean> {
    return Boolean(await this.users.findAdmin());
  }

  private async isServerConfigured(): Promise<boolean> {
    return Boolean(await this.settings.get(PLEX_BASE_URL_SETTING));
  }
}
