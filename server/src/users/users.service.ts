import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SecretEncryptionService } from "../security/secret-encryption.service";
import { LinkedUser } from "./linked-user.entity";

export type UpsertLinkedUserInput = {
  plexUserId: string;
  plexUsername: string;
  plexThumb?: string;
  plexToken: string;
  plexAccountToken?: string;
  plexServerIdentifier?: string;
  plexServerName?: string;
  isAdmin: boolean;
  isManaged?: boolean;
  managedByPlexUserId?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(LinkedUser)
    private readonly linkedUsers: Repository<LinkedUser>,
    @Inject(SecretEncryptionService)
    private readonly encryption: SecretEncryptionService,
  ) {}

  async list(): Promise<LinkedUser[]> {
    return this.decryptUsers(
      await this.linkedUsers.find({ order: { createdAt: "ASC" } }),
    );
  }

  async listEnabled(): Promise<LinkedUser[]> {
    return this.decryptUsers(
      await this.linkedUsers.find({
        where: { enabled: true },
        order: { createdAt: "ASC" },
      }),
    );
  }

  async findById(id: string): Promise<LinkedUser> {
    const user = await this.linkedUsers.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException("Linked user not found.");
    }

    return this.decryptUser(user);
  }

  async findLinkedAdminWithAccountToken(): Promise<LinkedUser | null> {
    const user = await this.linkedUsers.findOne({
      where: { isAdmin: true, enabled: true },
      order: { createdAt: "ASC" },
    });
    return user ? this.decryptUser(user) : null;
  }

  async findAdmin(): Promise<LinkedUser | null> {
    const user = await this.linkedUsers.findOne({
      where: { isAdmin: true },
      order: { createdAt: "ASC" },
    });
    return user ? this.decryptUser(user) : null;
  }

  async upsertFromPlex(input: UpsertLinkedUserInput): Promise<LinkedUser> {
    const existing = await this.linkedUsers.findOne({
      where: { plexUserId: input.plexUserId },
    });

    const user = this.linkedUsers.merge(existing ?? this.linkedUsers.create(), {
      ...input,
      enabled: true,
    });

    return this.saveEncrypted(user);
  }

  async setEnabled(id: string, enabled: boolean): Promise<LinkedUser> {
    const user = await this.findById(id);
    user.enabled = enabled;
    return this.saveEncrypted(user);
  }

  async markSynced(user: LinkedUser): Promise<void> {
    user.lastSyncAt = new Date();
    await this.saveEncrypted(user);
  }

  async updateServerSelection(
    user: LinkedUser,
    input: {
      plexToken: string;
      plexServerIdentifier: string;
      plexServerName: string;
    },
  ): Promise<void> {
    user.plexToken = input.plexToken;
    user.plexServerIdentifier = input.plexServerIdentifier;
    user.plexServerName = input.plexServerName;
    await this.saveEncrypted(user);
  }

  async remove(id: string): Promise<void> {
    const result = await this.linkedUsers.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException("Linked user not found.");
    }
  }

  private async saveEncrypted(user: LinkedUser): Promise<LinkedUser> {
    const plaintextToken = this.encryption.decrypt(user.plexToken) ?? "";
    const plaintextAccountToken = this.encryption.decrypt(
      user.plexAccountToken,
    );
    user.plexToken = this.encryption.encrypt(plaintextToken) ?? "";
    user.plexAccountToken = this.encryption.encrypt(plaintextAccountToken);

    const saved = await this.linkedUsers.save(user);
    return this.decryptUser(saved);
  }

  private decryptUsers(users: LinkedUser[]): LinkedUser[] {
    return users.map((user) => this.decryptUser(user));
  }

  private decryptUser(user: LinkedUser): LinkedUser {
    user.plexToken = this.encryption.decrypt(user.plexToken) ?? "";
    user.plexAccountToken = this.encryption.decrypt(user.plexAccountToken);
    return user;
  }
}
