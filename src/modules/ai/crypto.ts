import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// AES-256-GCM para las API keys BYOK: nunca se almacenan en claro ni viajan
// al cliente. La llave maestra vive solo en el entorno (AI_KEYS_MASTER_KEY,
// 32 bytes en base64).
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

export function encryptSecret(plaintext: string, masterKeyB64: string): string {
  const key = parseMasterKey(masterKeyB64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // formato: iv.tag.ciphertext (base64url)
  return [iv, tag, encrypted]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function decryptSecret(payload: string, masterKeyB64: string): string {
  const key = parseMasterKey(masterKeyB64);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseMasterKey(masterKeyB64: string): Buffer {
  const key = Buffer.from(masterKeyB64, "base64");
  if (key.length !== 32) {
    throw new Error("AI_KEYS_MASTER_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}
