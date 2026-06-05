import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Logger,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { PlexService } from "../plex/plex.service";
import { toLinkedUserResponse } from "../users/linked-user-response.dto";
import { UsersService } from "../users/users.service";
import { SessionsService, SESSION_COOKIE_NAME } from "./sessions.service";
import { SetupService } from "./setup.service";

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
    @Headers("x-setup-token") setupToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const numericPinId = Number(pinId);
    const initialSetup = await this.setup.authorizeInitialSetup(
      numericPinId,
      setupToken,
    );
    let resolved: Awaited<ReturnType<PlexService["pollPin"]>>;

    try {
      resolved = await this.plex.pollPin(numericPinId);
    } catch (error) {
      if (initialSetup) {
        this.setup.releaseInitialSetup(numericPinId);
      }
      throw error;
    }

    if (!resolved) {
      return { linked: false };
    }

    if (initialSetup && !resolved.isAdmin) {
      this.setup.releaseInitialSetup(numericPinId);
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

    if (initialSetup) {
      await this.setup.completeInitialSetup(numericPinId);
    }

    const session = await this.sessions.create(user);
    this.setSessionCookie(response, session.token, session.expiresAt);
    this.logger.log(
      `Linked Plex user ${user.plexUsername} (${user.plexUserId}).`,
    );
    return { linked: true, user: toLinkedUserResponse(user) };
  }

  private setSessionCookie(
    response: Response,
    token: string,
    expiresAt: Date,
  ): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: expiresAt,
    });
  }
}
