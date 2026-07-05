import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM encryption for partner BYOK API keys. The master key never
// leaves the server (AI_KEYS_MASTER_KEY, 32 bytes base64). Stored format:
//   <iv_base64>:<authTag_base64>:<ciphertext_base64>

const ALGO = "aes-256-gcm";

export class CryptoConfigError extends Error {}

function masterKey(): Buffer {
  const raw = process.env.AI_KEYS_MASTER_KEY;
  if (!raw) {
    throw new CryptoConfigError("AI_KEYS_MASTER_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new CryptoConfigError(
      "AI_KEYS_MASTER_KEY must decode to 32 bytes (base64)",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("malformed encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGO,
    masterKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Last 4 chars, for showing which key is stored without decrypting it. */
export function keyHint(plaintext: string): string {
  return plaintext.slice(-4);
}
