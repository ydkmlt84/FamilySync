import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SetupService } from "./setup.service";

function makeService({
  admin = null,
  adminPlexUserId,
  completed = false,
  setupToken,
}: {
  admin?: object | null;
  adminPlexUserId?: string;
  completed?: boolean;
  setupToken?: string;
} = {}) {
  const config = {
    get: vi.fn((key: string) => {
      if (key === "setupToken") {
        return setupToken;
      }
      if (key === "plex.adminPlexUserId") {
        return adminPlexUserId;
      }
      return undefined;
    }),
  };
  const users = { findAdmin: vi.fn().mockResolvedValue(admin) };
  const settings = {
    get: vi.fn().mockResolvedValue(completed ? "true" : undefined),
    set: vi.fn(),
  };
  return {
    service: new SetupService(
      config as never,
      users as never,
      settings as never,
    ),
    settings,
  };
}

describe("SetupService", () => {
  it("reports setup status and accepts the configured token", async () => {
    const token = "a".repeat(32);
    const { service } = makeService({ setupToken: token });

    await expect(service.status()).resolves.toEqual({ setupRequired: true });
    await expect(service.authorizeInitialSetup(1, token)).resolves.toBe(true);
  });

  it("does not require setup after an admin exists or is preconfigured", async () => {
    const existingAdmin = makeService({ admin: { id: "admin" } });
    await expect(existingAdmin.service.authorizeInitialSetup(1)).resolves.toBe(
      false,
    );
    expect(existingAdmin.settings.set).toHaveBeenCalledWith(
      "setup.completed",
      "true",
    );

    await expect(
      makeService({
        adminPlexUserId: "123",
      }).service.authorizeInitialSetup(1),
    ).resolves.toBe(false);
  });

  it("rejects missing configuration and invalid tokens", async () => {
    await expect(
      makeService().service.authorizeInitialSetup(1),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      makeService({
        setupToken: "e".repeat(32),
      }).service.authorizeInitialSetup(1, "wrong"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows one setup PIN at a time and supports releasing a failed claim", async () => {
    const token = "e".repeat(32);
    const { service } = makeService({ setupToken: token });
    await service.authorizeInitialSetup(1, token);

    await expect(service.authorizeInitialSetup(2, token)).rejects.toThrow(
      "Initial setup is already in progress.",
    );

    service.releaseInitialSetup(1);
    await expect(service.authorizeInitialSetup(2, token)).resolves.toBe(true);
  });

  it("permanently closes setup after completion", async () => {
    const token = "a".repeat(32);
    const { service, settings } = makeService({ setupToken: token });
    await service.authorizeInitialSetup(1, token);
    await service.completeInitialSetup(1);
    expect(settings.set).toHaveBeenCalledWith("setup.completed", "true");

    settings.get.mockResolvedValue("true");
    await expect(service.authorizeInitialSetup(2)).resolves.toBe(false);
  });
});
