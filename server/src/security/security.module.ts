import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LinkedUser } from "../users/linked-user.entity";
import { AppSetting } from "../settings/app-setting.entity";
import { SecretEncryptionService } from "./secret-encryption.service";
import { SecretMigrationService } from "./secret-migration.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LinkedUser, AppSetting])],
  providers: [SecretEncryptionService, SecretMigrationService],
  exports: [SecretEncryptionService],
})
export class SecurityModule {}
