import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from "node:crypto";

const ALGORITHM: CipherGCMTypes = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.INSTANCE_CONFIG_ENC_KEY;
  if (!raw) {
    throw new Error(
      "INSTANCE_CONFIG_ENC_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `INSTANCE_CONFIG_ENC_KEY must decode to 32 bytes (got ${key.length}).`,
    );
  }
  return key;
}

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptJSON(obj: unknown): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptJSON<T>(parts: EncryptedPayload): T {
  const key = getKey();
  const iv = Buffer.from(parts.iv, "base64");
  const authTag = Buffer.from(parts.authTag, "base64");
  const ciphertext = Buffer.from(parts.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
