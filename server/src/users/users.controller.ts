import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { SessionsService } from "../auth/sessions.service";
import { PlexService } from "../plex/plex.service";
import { toLinkedUserResponse } from "./linked-user-response.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(AuthGuard, AdminGuard)
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(PlexService) private readonly plex: PlexService,
  ) {}

  @Get()
  async list() {
    return (await this.users.list()).map(toLinkedUserResponse);
  }

  @Get("managed-home")
  async managedHomeUsers() {
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin?.plexAccountToken) {
      throw new BadRequestException(
        "Link the Plex server admin account before importing managed users.",
      );
    }

    const linkedUsers = await this.users.list();

    return this.plex.listManagedHomeUsers(
      admin.plexAccountToken,
      new Set(linkedUsers.map((user) => user.plexUserId)),
    );
  }

  @Post("managed-home/:plexUserId")
  async importManagedHomeUser(
    @Param("plexUserId") plexUserId: string,
    @Body("pin") pin?: string,
  ) {
    const admin = await this.users.findLinkedAdminWithAccountToken();

    if (!admin) {
      throw new BadRequestException(
        "Link the Plex server admin account before importing managed users.",
      );
    }

    const resolved = await this.plex.resolveManagedHomeUser(
      admin,
      plexUserId,
      pin?.trim() || undefined,
    );

    const user = await this.users.upsertFromPlex({
      plexUserId: resolved.plexUserId,
      plexUsername: resolved.plexUsername,
      plexThumb: resolved.plexThumb,
      plexToken: resolved.serverAccessToken,
      plexAccountToken: resolved.accountToken,
      plexServerIdentifier: resolved.serverClientIdentifier,
      plexServerName: resolved.serverName,
      isAdmin: false,
      isManaged: true,
      managedByPlexUserId: admin.plexUserId,
    });

    return toLinkedUserResponse(user);
  }

  @Patch(":id")
  async setEnabled(@Param("id") id: string, @Body("enabled") enabled: boolean) {
    return toLinkedUserResponse(
      await this.users.setEnabled(id, Boolean(enabled)),
    );
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.sessions.revokeUserSessions(id);
    await this.users.remove(id);
    return { removed: true };
  }
}
