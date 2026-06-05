import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "./admin.guard";
import { AuthGuard } from "./auth.guard";
import { SessionsService } from "./sessions.service";

function contextFor(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe("authentication guards", () => {
  it("authenticates an enabled session user", async () => {
    const user = { id: "1", enabled: true };
    const request = { cookies: { familysync_session: "token" } };
    const guard = new AuthGuard(
      { findUserIdByToken: vi.fn().mockResolvedValue("1") } as never,
      { findById: vi.fn().mockResolvedValue(user) } as never,
    );

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty("user", user);
  });

  it("rejects missing sessions and disabled users", async () => {
    const noSession = new AuthGuard(
      { findUserIdByToken: vi.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );
    await expect(noSession.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const disabled = new AuthGuard(
      { findUserIdByToken: vi.fn().mockResolvedValue("1") } as never,
      { findById: vi.fn().mockResolvedValue({ enabled: false }) } as never,
    );
    await expect(disabled.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("requires an administrator", () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextFor({ user: { isAdmin: true } }))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(contextFor({ user: { isAdmin: false } })),
    ).toThrow(UnauthorizedException);
  });
});

describe("SessionsService", () => {
  it("creates hashed sessions and resolves active users", async () => {
    const repository = {
      create: vi.fn((value) => ({ id: "session", ...value })),
      save: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    };
    const service = new SessionsService(repository as never);
    const created = await service.create({ id: "user-1" } as never);
    const saved = repository.save.mock.calls[0][0];

    expect(created.token).toHaveLength(43);
    expect(saved.tokenHash).not.toBe(created.token);
    expect(saved.linkedUserId).toBe("user-1");

    repository.findOne.mockResolvedValue({
      id: "session",
      linkedUserId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.findUserIdByToken(created.token)).resolves.toBe(
      "user-1",
    );
  });

  it("handles missing, unknown, and expired sessions", async () => {
    const repository = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "expired",
          expiresAt: new Date(Date.now() - 1),
        }),
      delete: vi.fn(),
    };
    const service = new SessionsService(repository as never);

    await expect(service.findUserIdByToken(undefined)).resolves.toBeUndefined();
    await expect(service.findUserIdByToken("unknown")).resolves.toBeUndefined();
    await expect(service.findUserIdByToken("expired")).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith("expired");
  });

  it("revokes tokens, user sessions, and expired sessions", async () => {
    const repository = {
      create: vi.fn(),
      save: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    };
    const service = new SessionsService(repository as never);

    await service.revokeToken(undefined);
    await service.revokeToken("token");
    await service.revokeUserSessions("user-1");
    await service.deleteExpired();

    expect(repository.delete).toHaveBeenCalledTimes(3);
    expect(repository.delete).toHaveBeenCalledWith({
      linkedUserId: "user-1",
    });
  });
});
