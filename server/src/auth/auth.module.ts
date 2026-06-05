import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlexModule } from "../plex/plex.module";
import { UsersModule } from "../users/users.module";
import { SettingsModule } from "../settings/settings.module";
import { AuthController } from "./auth.controller";
import { SessionController } from "./session.controller";
import { UserSession } from "./user-session.entity";
import { SessionsService } from "./sessions.service";
import { AuthGuard } from "./auth.guard";
import { AdminGuard } from "./admin.guard";
import { SetupService } from "./setup.service";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserSession]),
    PlexModule,
    UsersModule,
    SettingsModule,
  ],
  controllers: [AuthController, SessionController],
  providers: [SessionsService, AuthGuard, AdminGuard, SetupService],
  exports: [SessionsService, AuthGuard, AdminGuard],
})
export class AuthModule {}
