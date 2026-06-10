import {
  Controller,
  Body,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { PlexService } from "../plex/plex.service";
import {
  PLEX_BASE_URL_SETTING,
  SettingsService,
} from "../settings/settings.service";
import { UsersService } from "../users/users.service";
import { RatingsService } from "./ratings.service";

@Controller("media")
export class RatingsController {
  constructor(
    @Inject(RatingsService) private readonly ratings: RatingsService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(PlexService) private readonly plex: PlexService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Get("favorites")
  @UseGuards(AuthGuard)
  favorites() {
    return this.ratings.listFavorites();
  }

  @Get("carousel")
  carousel() {
    return this.ratings.listPublicCarousel();
  }

  @Get("carousel/:ratingKey/poster")
  async carouselPoster(
    @Param("ratingKey") ratingKey: string,
    @Res() response: Response,
  ) {
    if (!(await this.ratings.isPublicCarouselItem(ratingKey))) {
      throw new NotFoundException("Poster not found.");
    }

    const posterPath = await this.ratings.getPosterPath(ratingKey);

    if (!posterPath) {
      throw new NotFoundException("Poster not found.");
    }

    return this.sendPoster(posterPath, response);
  }

  @Get("carousel/:ratingKey/raters")
  @UseGuards(AuthGuard, AdminGuard)
  async carouselRaters(@Param("ratingKey") ratingKey: string) {
    if (!(await this.ratings.isPublicCarouselItem(ratingKey))) {
      throw new NotFoundException("Carousel item not found.");
    }

    return { names: await this.ratings.listCarouselRaterNames(ratingKey) };
  }

  @Get("excluded")
  @UseGuards(AuthGuard, AdminGuard)
  excluded() {
    return this.ratings.listExcludedMedia();
  }

  @Get("search")
  @UseGuards(AuthGuard, AdminGuard)
  search(@Query("query") query = "") {
    return this.ratings.searchCachedMedia(query);
  }

  @Get(":ratingKey/details")
  @UseGuards(AuthGuard)
  details(@Param("ratingKey") ratingKey: string) {
    return this.ratings.getDetails(ratingKey);
  }

  @Patch(":ratingKey/override")
  @UseGuards(AuthGuard, AdminGuard)
  async override(
    @Param("ratingKey") ratingKey: string,
    @Body() body: { taggingExcluded?: boolean },
  ) {
    await this.ratings.setTaggingExcluded(
      ratingKey,
      Boolean(body.taggingExcluded),
    );
    return this.ratings.getDetails(ratingKey);
  }

  @Get(":ratingKey/poster")
  @UseGuards(AuthGuard)
  async poster(
    @Param("ratingKey") ratingKey: string,
    @Res() response: Response,
  ) {
    let posterPath = await this.ratings.getPosterPath(ratingKey);
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin) {
      throw new NotFoundException("Poster not found.");
    }

    if (!posterPath) {
      const metadata = await this.plex.getMediaMetadata(
        ratingKey,
        admin.plexToken,
      );
      posterPath = metadata.thumb;

      if (posterPath) {
        await this.ratings.setPosterPath(ratingKey, posterPath);
      }
    }

    if (!posterPath) {
      throw new NotFoundException("Poster not found.");
    }

    return this.sendPoster(posterPath, response, admin.plexToken);
  }

  @Get(":ratingKey")
  @UseGuards(AuthGuard)
  aggregate(@Param("ratingKey") ratingKey: string) {
    return this.ratings.aggregate(ratingKey);
  }

  private async sendPoster(
    posterPath: string,
    response: Response,
    plexToken?: string,
  ): Promise<void> {
    const admin =
      plexToken === undefined
        ? await this.users.findLinkedAdminWithAccountToken()
        : undefined;
    const token = plexToken ?? admin?.plexToken;
    const baseUrl = (await this.settings.get(PLEX_BASE_URL_SETTING))?.replace(
      /\/+$/,
      "",
    );

    if (!baseUrl || !token) {
      throw new NotFoundException("Plex base URL is not configured.");
    }

    const url = new URL(`${baseUrl}${posterPath}`);
    const plexResponse = await fetch(url, {
      headers: { "X-Plex-Token": token },
    });

    if (!plexResponse.ok || !plexResponse.body) {
      throw new NotFoundException("Poster not found.");
    }

    response.setHeader(
      "Content-Type",
      plexResponse.headers.get("content-type") ?? "image/jpeg",
    );
    response.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = Buffer.from(await plexResponse.arrayBuffer());
    response.send(buffer);
  }
}
