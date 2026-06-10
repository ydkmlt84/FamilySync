import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SecretEncryptionService } from "./secret-encryption.service";

function makeService(key?: string, previousKey?: string) {
  return new SecretEncryptionService({
    get: vi.fn((name: string) =>
      name === "previousEncryptionKey" ? previousKey : key,
    ),
  } as never);
}

describe("SecretEncryptionService", () => {
  it("round trips secrets using a versioned randomized format", () => {
    const service = makeService("a".repeat(32));
    const first = service.encrypt("secret") as string;
    const second = service.encrypt("secret") as string;

    expect(first).toMatch(/^enc:v1:/);
    expect(second).not.toBe(first);
    expect(service.decrypt(first)).toBe("secret");
    expect(service.decrypt(second)).toBe("secret");
  });

  it("passes plaintext through during migration reads", () => {
    const service = makeService("a".repeat(32));
    expect(service.decrypt("plaintext")).toBe("plaintext");
    expect(service.encrypt(undefined)).toBeUndefined();
  });

  it("rejects missing keys, wrong keys, and tampered ciphertext", () => {
    expect(() => makeService().encrypt("secret")).toThrow(
      ServiceUnavailableException,
    );

    const encrypted = makeService("a".repeat(32)).encrypt("secret") as string;
    const tampered = `${encrypted.slice(0, -1)}${
      encrypted.endsWith("x") ? "y" : "x"
    }`;
    expect(() => makeService("b".repeat(32)).decrypt(encrypted)).toThrow(
      "Verify APP_ENCRYPTION_KEY",
    );
    expect(() => makeService("a".repeat(32)).decrypt(tampered)).toThrow(
      "Verify APP_ENCRYPTION_KEY",
    );
  });

  it("supports one-step key rotation", () => {
    const oldKey = "a".repeat(32);
    const newKey = "b".repeat(32);
    const encrypted = makeService(oldKey).encrypt("secret") as string;
    const rotating = makeService(newKey, oldKey);

    expect(rotating.decrypt(encrypted)).toBe("secret");
    expect(rotating.needsReencryption(encrypted)).toBe(true);
    const rotated = rotating.encrypt(rotating.decrypt(encrypted)) as string;
    expect(makeService(newKey).decrypt(rotated)).toBe("secret");
  });
});
