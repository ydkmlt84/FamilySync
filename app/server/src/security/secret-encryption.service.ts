import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1:";

@Injectable()
export class SecretEncryptionService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  isEncrypted(value: string | undefined): boolean {
    return Boolean(value?.startsWith(ENCRYPTED_PREFIX));
  }

  encrypt(value: string | undefined): string | undefined {
    if (!value || this.isEncrypted(value)) {
      return value;
    }

    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      "enc",
      "v1",
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(":");
  }

  decrypt(value: string | undefined): string | undefined {
    if (!value || !this.isEncrypted(value)) {
      return value;
    }

    const parts = value.split(":");
    if (parts.length !== 5) {
      throw new ServiceUnavailableException(
        "Stored secret has an unsupported encrypted format.",
      );
    }

    for (const key of this.getDecryptionKeys()) {
      try {
        return this.decryptWithKey(parts, key);
      } catch {
        continue;
      }
    }

    throw new ServiceUnavailableException(
      "Stored secrets could not be decrypted. Verify APP_ENCRYPTION_KEY.",
    );
  }

  needsReencryption(value: string): boolean {
    if (!this.isEncrypted(value)) {
      return true;
    }

    try {
      this.decryptWithKey(value.split(":"), this.getKey());
      return false;
    } catch {
      this.decrypt(value);
      return true;
    }
  }

  assertConfigured(): void {
    this.getKey();
  }

  private getKey(): Buffer {
    const configured = this.config.get<string>("encryptionKey")?.trim();
    if (!configured || configured.length < 32) {
      throw new ServiceUnavailableException(
        "APP_ENCRYPTION_KEY must be configured with at least 32 characters.",
      );
    }

    return createHash("sha256").update(configured).digest();
  }

  private getDecryptionKeys(): Buffer[] {
    const keys = [this.getKey()];
    const previous = this.config.get<string>("previousEncryptionKey")?.trim();
    if (previous && previous.length >= 32) {
      keys.push(createHash("sha256").update(previous).digest());
    }
    return keys;
  }

  private decryptWithKey(parts: string[], key: Buffer): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parts[2], "base64url"),
    );
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[4], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
