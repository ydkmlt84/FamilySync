import { describe, expect, it } from "vitest";
import { LinkedUser } from "./linked-user.entity";
import { toLinkedUserResponse } from "./linked-user-response.dto";

describe("toLinkedUserResponse", () => {
  it("returns only client-safe linked-user fields", () => {
    const user = Object.assign(new LinkedUser(), {
      id: "user-id",
      plexUserId: "plex-id",
      plexUsername: "alex",
      plexThumb: "thumb",
      plexToken: "server-secret",
      plexAccountToken: "account-secret",
      plexServerIdentifier: "server-id",
      plexServerName: "Home",
      enabled: true,
      isAdmin: true,
      isManaged: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });

    const response = toLinkedUserResponse(user);

    expect(response).toMatchObject({
      id: "user-id",
      plexUserId: "plex-id",
      plexUsername: "alex",
      plexServerName: "Home",
      isAdmin: true,
    });
    expect(response).not.toHaveProperty("plexToken");
    expect(response).not.toHaveProperty("plexAccountToken");
    expect(JSON.stringify(response)).not.toContain("secret");
  });
});
