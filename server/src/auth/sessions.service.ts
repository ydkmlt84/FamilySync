import { randomBytes, createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { LinkedUser } from "../users/linked-user.entity";
import { UserSession } from "./user-session.entity";

export const SESSION_COOKIE_NAME = "familysync_session";

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
  ) {}

  async create(user: LinkedUser): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await this.sessions.save(
      this.sessions.create({
        tokenHash: this.hash(token),
        linkedUserId: user.id,
        expiresAt,
      }),
    );

    return { token, expiresAt };
  }

  async findUserIdByToken(
    token: string | undefined,
  ): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }

    const session = await this.sessions.findOne({
      where: { tokenHash: this.hash(token) },
    });

    if (!session) {
      return undefined;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.delete(session.id);
      return undefined;
    }

    return session.linkedUserId;
  }

  async revokeToken(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.sessions.delete({ tokenHash: this.hash(token) });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.sessions.delete({ linkedUserId: userId });
  }

  async deleteExpired(): Promise<void> {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
