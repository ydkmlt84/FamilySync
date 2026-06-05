import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class IntegrationSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  tagName?: string;

  @IsOptional()
  @IsBoolean()
  removeTagsWhenUnprotected?: boolean;
}

export type IntegrationSettingsResponseDto = {
  enabled: boolean;
  url: string;
  apiKeyConfigured: boolean;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
};

export function toIntegrationSettingsResponse(settings: {
  enabled: boolean;
  url: string;
  apiKey: string;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
}): IntegrationSettingsResponseDto {
  return {
    enabled: settings.enabled,
    url: settings.url,
    apiKeyConfigured: Boolean(settings.apiKey),
    tagName: settings.tagName,
    removeTagsWhenUnprotected: settings.removeTagsWhenUnprotected,
  };
}

export class ProtectedTagSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  tagName?: string;

  @IsOptional()
  @IsBoolean()
  removeTagsWhenUnprotected?: boolean;
}

export class LowRatedSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  tagName?: string;

  @IsOptional()
  @IsNumber()
  averageThreshold?: number;

  @IsOptional()
  @IsNumber()
  minimumRatings?: number;

  @IsOptional()
  @IsBoolean()
  removeTagsWhenNotLowRated?: boolean;
}

export class SyncSettingsDto {
  @IsOptional()
  @IsNumber()
  protectionThreshold?: number;

  @IsOptional()
  @IsBoolean()
  taggingEnabled?: boolean;

  @IsOptional()
  @IsIn(["info", "debug"])
  logLevel?: "info" | "debug";

  @IsOptional()
  @ValidateNested()
  @Type(() => ProtectedTagSettingsDto)
  protectedTag?: ProtectedTagSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LowRatedSettingsDto)
  lowRated?: LowRatedSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationSettingsDto)
  radarr?: IntegrationSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IntegrationSettingsDto)
  sonarr?: IntegrationSettingsDto;
}

export class CronJobSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(["disabled", "6h", "12h", "daily", "weekly", "custom"])
  preset?: "disabled" | "6h" | "12h" | "daily" | "weekly" | "custom";

  @IsOptional()
  @IsString()
  cron?: string;
}

export class JobsSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CronJobSettingsDto)
  ratingSync?: CronJobSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CronJobSettingsDto)
  tagSync?: CronJobSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CronJobSettingsDto)
  metadataSync?: CronJobSettingsDto;
}
