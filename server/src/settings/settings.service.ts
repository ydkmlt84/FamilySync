import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SecretEncryptionService } from "../security/secret-encryption.service";
import { AppSetting } from "./app-setting.entity";

export const PLEX_SERVER_IDENTIFIER_SETTING = "plex.serverIdentifier";
export const PLEX_SERVER_NAME_SETTING = "plex.serverName";
export const PLEX_SELECTED_MOVIE_LIBRARY_KEYS_SETTING =
  "plex.selectedMovieLibraryKeys";
export const PLEX_SELECTED_TV_LIBRARY_KEYS_SETTING =
  "plex.selectedTvLibraryKeys";
export const RATING_PROTECTION_THRESHOLD_SETTING =
  "ratings.protectionThreshold";
export const TAGGING_ENABLED_SETTING = "tagging.enabled";
export const PROTECTED_TAGGING_SETTING = "tagging.protected";
export const LOW_RATED_TAGGING_SETTING = "tagging.lowRated";
export const LOG_LEVEL_SETTING = "logging.level";
export const RATING_SYNC_JOB_SETTING = "jobs.ratingSync";
export const TAG_SYNC_JOB_SETTING = "jobs.tagSync";
export const METADATA_SYNC_JOB_SETTING = "jobs.metadataSync";
export const RADARR_SETTINGS_SETTING = "radarr.settings";
export const SONARR_SETTINGS_SETTING = "sonarr.settings";
export const SETUP_COMPLETED_SETTING = "setup.completed";

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
    @Inject(SecretEncryptionService)
    private readonly encryption: SecretEncryptionService,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const value = (await this.settings.findOne({ where: { key } }))?.value;
    return this.isSecretSetting(key) ? this.encryption.decrypt(value) : value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.settings.save(
      this.settings.create({
        key,
        value: this.isSecretSetting(key)
          ? (this.encryption.encrypt(value) ?? value)
          : value,
      }),
    );
  }

  async getJson<T>(key: string, fallback: T): Promise<T> {
    const value = await this.get(key);

    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  private isSecretSetting(key: string): boolean {
    return key === RADARR_SETTINGS_SETTING || key === SONARR_SETTINGS_SETTING;
  }
}
