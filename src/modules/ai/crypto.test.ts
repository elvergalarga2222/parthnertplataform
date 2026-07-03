import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const masterKey = randomBytes(32).toString("base64");

describe("AI key encryption (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const secret = "sk-ant-api03-abc123";
    const encrypted = encryptSecret(secret, masterKey);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, masterKey)).toBe(secret);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const secret = "sk-ant-api03-abc123";
    expect(encryptSecret(secret, masterKey)).not.toBe(
      encryptSecret(secret, masterKey),
    );
  });

  it("fails to decrypt with a different master key", () => {
    const other = randomBytes(32).toString("base64");
    const encrypted = encryptSecret("secret", masterKey);
    expect(() => decryptSecret(encrypted, other)).toThrow();
  });

  it("fails on tampered ciphertext (auth tag)", () => {
    const encrypted = encryptSecret("secret", masterKey);
    const parts = encrypted.split(".");
    const tampered = Buffer.from(parts[2], "base64url");
    tampered[0] ^= 0xff;
    parts[2] = tampered.toString("base64url");
    expect(() => decryptSecret(parts.join("."), masterKey)).toThrow();
  });

  it("rejects master keys that are not 32 bytes", () => {
    expect(() => encryptSecret("x", Buffer.from("short").toString("base64"))).toThrow(
      /32 bytes/,
    );
  });
});
