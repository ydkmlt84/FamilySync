import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  SettingsService,
  SONARR_SETTINGS_SETTING,
} from "../settings/settings.service";

type SonarrSeries = {
  id: number;
  title: string;
  tvdbId?: number;
  tags: number[];
};

type SonarrTag = {
  id: number;
  label: string;
};

export type SonarrConnectionSettings = {
  enabled: boolean;
  url: string;
  apiKey: string;
  tagName: string;
  removeTagsWhenUnprotected: boolean;
};

@Injectable()
export class SonarrService {
  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async getSettings(): Promise<SonarrConnectionSettings> {
    const saved = await this.settings.getJson<
      Partial<SonarrConnectionSettings>
    >(SONARR_SETTINGS_SETTING, {});

    return {
      enabled: saved.enabled ?? false,
      url: (saved.url ?? "").replace(/\/+$/, ""),
      apiKey: saved.apiKey ?? "",
      tagName: saved.tagName ?? "family-favorite",
      removeTagsWhenUnprotected: saved.removeTagsWhenUnprotected ?? false,
    };
  }

  async updateSettings(
    settings: Partial<SonarrConnectionSettings>,
  ): Promise<SonarrConnectionSettings> {
    const next = await this.normalizeSettings(settings);

    await this.settings.setJson(SONARR_SETTINGS_SETTING, next);
    return next;
  }

  async testConnection(
    settings?: Partial<SonarrConnectionSettings>,
  ): Promise<{ ok: boolean; seriesCount: number }> {
    const series = await this.sonarrFetch<SonarrSeries[]>(
      "/api/v3/series",
      {},
      settings,
    );
    return { ok: true, seriesCount: series.length };
  }

  async syncProtection(
    tvdbId: number | undefined,
    isProtected: boolean,
  ): Promise<void> {
    const settings = await this.getSettings();
    await this.syncProtectedTag(
      tvdbId,
      isProtected,
      settings.tagName,
      settings.removeTagsWhenUnprotected,
    );
  }

  async syncProtectedTag(
    tvdbId: number | undefined,
    isProtected: boolean,
    tagName: string,
    removeTagsWhenUnprotected: boolean,
  ): Promise<void> {
    await this.syncTag(tvdbId, isProtected, tagName, removeTagsWhenUnprotected);
  }

  async syncLowRated(
    tvdbId: number | undefined,
    isLowRated: boolean,
    tagName: string,
    removeTagsWhenNotLowRated: boolean,
  ): Promise<void> {
    await this.syncTag(tvdbId, isLowRated, tagName, removeTagsWhenNotLowRated);
  }

  private async syncTag(
    tvdbId: number | undefined,
    shouldHaveTag: boolean,
    tagName: string,
    removeTagWhenFalse: boolean,
  ): Promise<void> {
    const settings = await this.getSettings();

    if (!settings.enabled || !tvdbId) {
      return;
    }

    const series = await this.findSeries(tvdbId);

    if (!series) {
      return;
    }

    const tag = await this.ensureTag(tagName);
    const hasTag = series.tags.includes(tag.id);

    if (shouldHaveTag && !hasTag) {
      await this.updateSeriesTags(series, [...series.tags, tag.id]);
    }

    if (!shouldHaveTag && hasTag && removeTagWhenFalse) {
      await this.updateSeriesTags(
        series,
        series.tags.filter((tagId) => tagId !== tag.id),
      );
    }
  }

  private async findSeries(tvdbId: number): Promise<SonarrSeries | undefined> {
    const series = await this.sonarrFetch<SonarrSeries[]>("/api/v3/series");
    return series.find((entry) => entry.tvdbId === tvdbId);
  }

  private async ensureTag(tagName: string): Promise<SonarrTag> {
    const tags = await this.sonarrFetch<SonarrTag[]>("/api/v3/tag");
    const existing = tags.find((tag) => tag.label === tagName);

    if (existing) {
      return existing;
    }

    return this.sonarrFetch<SonarrTag>("/api/v3/tag", {
      method: "POST",
      body: JSON.stringify({ label: tagName }),
    });
  }

  private async updateSeriesTags(
    series: SonarrSeries,
    tags: number[],
  ): Promise<void> {
    await this.sonarrFetch(`/api/v3/series/${series.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...series, tags }),
    });
  }

  private async sonarrFetch<T>(
    path: string,
    init: RequestInit = {},
    overrides?: Partial<SonarrConnectionSettings>,
  ): Promise<T> {
    const settings = overrides
      ? await this.normalizeSettings(overrides)
      : await this.getSettings();

    if (!settings.url || !settings.apiKey) {
      throw new BadRequestException("Sonarr URL or API key is missing.");
    }

    const response = await fetch(`${settings.url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        apikey: settings.apiKey,
        "X-Api-Key": settings.apiKey,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Sonarr request failed: HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async normalizeSettings(
    settings: Partial<SonarrConnectionSettings>,
  ): Promise<SonarrConnectionSettings> {
    const current = await this.getSettings();

    return {
      ...current,
      ...settings,
      enabled: Boolean(settings.enabled),
      url: (settings.url ?? current.url).replace(/\/+$/, ""),
      apiKey: settings.apiKey?.trim() || current.apiKey,
      tagName: settings.tagName?.trim() || current.tagName || "family-favorite",
      removeTagsWhenUnprotected: Boolean(settings.removeTagsWhenUnprotected),
    };
  }
}
