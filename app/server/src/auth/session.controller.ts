import {
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { toLinkedUserResponse } from "../users/linked-user-response.dto";
import { UsersService } from "../users/users.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { AuthGuard } from "./auth.guard";
import { SessionCookieService } from "./session-cookie.service";
import { SESSION_COOKIE_NAME, SessionsService } from "./sessions.service";

@Controller("auth")
export class SessionController {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SessionCookieService)
    private readonly sessionCookie: SessionCookieService,
  ) {}

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return request.user ? toLinkedUserResponse(request.user) : undefined;
  }

  @Post("logout")
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeToken(
      request.cookies?.[SESSION_COOKIE_NAME] as string | undefined,
    );
    this.sessionCookie.clear(response);
    return { loggedOut: true };
  }

  @Delete("me")
  @UseGuards(AuthGuard)
  async unlinkSelf(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.user) {
      return { removed: false };
    }

    await this.sessions.revokeUserSessions(request.user.id);
    await this.users.remove(request.user.id);
    this.sessionCookie.clear(response);
    return { removed: true };
  }
}
