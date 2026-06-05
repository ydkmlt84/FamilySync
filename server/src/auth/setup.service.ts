import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  SETUP_COMPLETED_SETTING,
  SettingsService,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";

@Injectable()
export class SetupService {
  private setupPin?: { pinId: number; expiresAt: number };

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async status(): Promise<{ setupRequired: boolean }> {
    return { setupRequired: await this.isSetupRequired() };
  }

  async authorizeInitialSetup(
    pinId: number,
    providedToken?: string,
  ): Promise<boolean> {
    if (!(await this.isSetupRequired())) {
      this.setupPin = undefined;
      return false;
    }

    const configuredToken = this.config.get<string>("setupToken");

    if (!configuredToken || configuredToken.length < 32) {
      throw new ServiceUnavailableException(
        "Initial setup is locked. Configure SETUP_TOKEN with at least 32 characters or set PLEX_ADMIN_USER_ID.",
      );
    }

    if (!providedToken || !this.matches(configuredToken, providedToken)) {
      throw new ForbiddenException("Invalid setup token.");
    }

    const now = Date.now();

    if (
      this.setupPin &&
      this.setupPin.expiresAt > now &&
      this.setupPin.pinId !== pinId
    ) {
      throw new ForbiddenException("Initial setup is already in progress.");
    }

    this.setupPin = { pinId, expiresAt: now + 10 * 60 * 1000 };
    return true;
  }

  async completeInitialSetup(pinId: number): Promise<void> {
    await this.settings.set(SETUP_COMPLETED_SETTING, "true");
    this.releaseInitialSetup(pinId);
  }

  releaseInitialSetup(pinId: number): void {
    if (this.setupPin?.pinId === pinId) {
      this.setupPin = undefined;
    }
  }

  private async isSetupRequired(): Promise<boolean> {
    if ((await this.settings.get(SETUP_COMPLETED_SETTING)) === "true") {
      return false;
    }

    if (await this.users.findAdmin()) {
      await this.settings.set(SETUP_COMPLETED_SETTING, "true");
      return false;
    }

    return !this.config.get<string>("plex.adminPlexUserId");
  }

  private matches(expected: string, provided: string): boolean {
    const expectedHash = createHash("sha256").update(expected).digest();
    const providedHash = createHash("sha256").update(provided).digest();
    return timingSafeEqual(expectedHash, providedHash);
  }
}
