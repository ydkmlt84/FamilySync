import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SESSION_COOKIE_NAME, SessionsService } from "./sessions.service";
import { UsersService } from "../users/users.service";
import { AuthenticatedRequest } from "./authenticated-request";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const userId = await this.sessions.findUserIdByToken(token);

    if (!userId) {
      throw new UnauthorizedException("Not signed in.");
    }

    const user = await this.users.findById(userId);

    if (!user.enabled) {
      throw new UnauthorizedException("Linked user is disabled.");
    }

    request.user = user;
    return true;
  }
}
