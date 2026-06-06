import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import type { Response } from "express";
import { PlexService } from "../plex/plex.service";
import { toLinkedUserResponse } from "../users/linked-user-response.dto";
import { UsersService } from "../users/users.service";
import { AdminGuard } from "./admin.guard";
import { AuthGuard } from "./auth.guard";
import { SessionCookieService } from "./session-cookie.service";
import { SessionsService } from "./sessions.service";
import { SetupService } from "./setup.service";

class TestConnectionDto {
  @IsString()
  @IsNotEmpty()
  uri!: string;
}

class ServerConfigDto {
  @IsString()
  @IsNotEmpty()
  baseUrl!: string;
}

@Controller("auth/plex")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(PlexService)
    private readonly plex: PlexService,
    @Inject(UsersService)
    private readonly users: UsersService,
    @Inject(SessionsService)
    private readonly sessions: SessionsService,
    @Inject(SetupService)
    private readonly setup: SetupService,
    @Inject(SessionCookieService)
    private readonly sessionCookie: SessionCookieService,
  ) {}

  @Get("setup")
  setupStatus() {
    return this.setup.status();
  }

  @Post("pin")
  createPin() {
    return this.plex.createPin();
  }

  @Get("pin/:pinId")
  async pollPin(
    @Param("pinId") pinId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const numericPinId = Number(pinId);
    const firstAdmin = await this.setup.needsFirstAdmin();
    const resolved = await this.plex.pollPin(numericPinId);

    if (!resolved) {
      return { linked: false };
    }

    if (firstAdmin && !resolved.isAdmin) {
      throw new ForbiddenException(
        "Initial setup must be completed by the Plex server owner.",
      );
    }

    const user = await this.users.upsertFromPlex({
      plexUserId: resolved.plexUserId,
      plexUsername: resolved.plexUsername,
      plexThumb: resolved.plexThumb,
      plexToken: resolved.serverAccessToken,
      plexAccountToken: resolved.accountToken,
      plexServerIdentifier: resolved.serverClientIdentifier,
      plexServerName: resolved.serverName,
      isAdmin: resolved.isAdmin,
    });

    const session = await this.sessions.create(user);
    this.sessionCookie.set(response, session.token, session.expiresAt);
    this.logger.log(
      `Linked Plex user ${user.plexUsername} (${user.plexUserId}).`,
    );
    return { linked: true, user: toLinkedUserResponse(user) };
  }

  @Get("server-candidates")
  @UseGuards(AuthGuard, AdminGuard)
  serverCandidates() {
    return this.setup.listServerCandidates();
  }

  @Post("test-connection")
  @UseGuards(AuthGuard, AdminGuard)
  testConnection(@Body() body: TestConnectionDto) {
    return this.setup.testServerConnection(body.uri);
  }

  @Post("server-config")
  @UseGuards(AuthGuard, AdminGuard)
  saveServerConfig(@Body() body: ServerConfigDto) {
    return this.setup.saveServerBaseUrl(body.baseUrl);
  }
}
