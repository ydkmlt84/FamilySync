import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";

function makeRepository() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((value = {}) => value),
    merge: vi.fn((target, value) => Object.assign(target, value)),
    save: vi.fn(async (value) => value),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

const encryption = {
  encrypt: vi.fn((value) => (value ? `encrypted:${value}` : value)),
  decrypt: vi.fn((value) =>
    typeof value === "string" && value.startsWith("encrypted:")
      ? value.slice("encrypted:".length)
      : value,
  ),
};

describe("UsersService", () => {
  it("queries linked users with expected ordering and filters", async () => {
    const repository = makeRepository();
    repository.find.mockResolvedValue([]);
    repository.findOne.mockResolvedValue(null);
    const service = new UsersService(repository as never, encryption as never);

    await service.list();
    await service.listEnabled();
    await service.findLinkedAdminWithAccountToken();
    await service.findAdmin();

    expect(repository.find).toHaveBeenNthCalledWith(1, {
      order: { createdAt: "ASC" },
    });
    expect(repository.find).toHaveBeenNthCalledWith(2, {
      where: { enabled: true },
      order: { createdAt: "ASC" },
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { isAdmin: true, enabled: true },
      order: { createdAt: "ASC" },
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { isAdmin: true },
      order: { createdAt: "ASC" },
    });
  });

  it("throws for a missing user", async () => {
    const repository = makeRepository();
    repository.findOne.mockResolvedValue(null);
    const service = new UsersService(repository as never, encryption as never);

    await expect(service.findById("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("checks whether a Plex account is already linked", async () => {
    const repository = makeRepository();
    repository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    const service = new UsersService(repository as never, encryption as never);

    await expect(service.existsByPlexUserId("plex-1")).resolves.toBe(true);
    await expect(service.existsByPlexUserId("missing")).resolves.toBe(false);
    expect(repository.count).toHaveBeenCalledWith({
      where: { plexUserId: "plex-1" },
    });
  });

  it("creates, updates, syncs, and removes users", async () => {
    const repository = makeRepository();
    repository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "1", enabled: true });
    repository.delete
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });
    const service = new UsersService(repository as never, encryption as never);

    const created = await service.upsertFromPlex({
      plexUserId: "plex-1",
      plexUsername: "Alex",
      plexToken: "token",
      isAdmin: false,
    });
    expect(created.enabled).toBe(true);
    expect(encryption.encrypt).toHaveBeenCalledWith("token");

    const disabled = await service.setEnabled("1", false);
    expect(disabled.enabled).toBe(false);

    await service.markSynced(disabled as never);
    expect(disabled.lastSyncAt).toBeInstanceOf(Date);

    await service.updateServerSelection(disabled as never, {
      plexToken: "new-token",
      plexServerIdentifier: "server-id",
      plexServerName: "Home",
    });
    expect(disabled).toMatchObject({
      plexToken: "new-token",
      plexServerIdentifier: "server-id",
      plexServerName: "Home",
    });

    await expect(service.remove("1")).resolves.toBeUndefined();
    await expect(service.remove("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
