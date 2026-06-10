import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { AppSetting } from "../settings/app-setting.entity";
import {
  RADARR_SETTINGS_SETTING,
  SONARR_SETTINGS_SETTING,
} from "../settings/settings.service";
import { LinkedUser } from "../users/linked-user.entity";
import { SecretEncryptionService } from "./secret-encryption.service";

@Injectable()
export class SecretMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SecretMigrationService.name);

  constructor(
    @InjectRepository(LinkedUser)
    private readonly linkedUsers: Repository<LinkedUser>,
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
    @Inject(SecretEncryptionService)
    private readonly encryption: SecretEncryptionService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const users = await this.linkedUsers.find();
    const integrationSettings = await this.settings.findBy({
      key: In([RADARR_SETTINGS_SETTING, SONARR_SETTINGS_SETTING]),
    });
    const hasSecrets =
      users.some((user) => user.plexToken || user.plexAccountToken) ||
      integrationSettings.some((setting) => this.hasApiKey(setting.value));

    if (!hasSecrets) {
      return;
    }

    this.encryption.assertConfigured();
    let migrated = 0;

    for (const user of users) {
      const plexToken = this.migrateValue(user.plexToken);
      const plexAccountToken = this.migrateValue(user.plexAccountToken);
      if (
        plexToken !== user.plexToken ||
        plexAccountToken !== user.plexAccountToken
      ) {
        await this.linkedUsers.update(user.id, {
          plexToken,
          plexAccountToken,
        });
        migrated += 1;
      }
    }

    for (const setting of integrationSettings) {
      const value = this.migrateIntegrationSetting(setting.value);
      if (value !== setting.value) {
        await this.settings.update(setting.key, { value });
        migrated += 1;
      }
    }

    if (migrated > 0) {
      this.logger.log(`Encrypted ${migrated} stored secret record(s).`);
    }
  }

  private migrateValue(value: string | undefined): string | undefined {
    if (!value) {
      return value;
    }
    if (this.encryption.isEncrypted(value)) {
      const plaintext = this.encryption.decrypt(value);
      return this.encryption.needsReencryption(value)
        ? this.encryption.encrypt(plaintext)
        : value;
    }
    return this.encryption.encrypt(value);
  }

  private hasApiKey(value: string): boolean {
    if (this.encryption.isEncrypted(value)) {
      return true;
    }
    try {
      return Boolean((JSON.parse(value) as { apiKey?: string }).apiKey);
    } catch {
      return false;
    }
  }

  private migrateIntegrationSetting(value: string): string {
    if (this.encryption.isEncrypted(value)) {
      const plaintext = this.encryption.decrypt(value);
      return this.encryption.needsReencryption(value)
        ? (this.encryption.encrypt(plaintext) ?? value)
        : value;
    }
    return this.encryption.encrypt(value) ?? value;
  }
}
