import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, keyHint } from "./crypto";

describe("ai crypto (AES-256-GCM)", () => {
  let prev: string | undefined;

  beforeAll(() => {
    prev = process.env.AI_KEYS_MASTER_KEY;
    process.env.AI_KEYS_MASTER_KEY = randomBytes(32).toString("base64");
  });
  afterAll(() => {
    process.env.AI_KEYS_MASTER_KEY = prev;
  });

  it("round-trips a secret", () => {
    const secret = "sk-ant-api03-abcdef1234567890";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("fails to decrypt if the ciphertext is tampered", () => {
    const encrypted = encryptSecret("secret-value-here");
    const [iv, tag, data] = encrypted.split(":");

    // Flip a byte in the ciphertext → GCM auth tag mismatch.
    const bytes = Buffer.from(data, "base64");
    bytes[0] ^= 0xff;
    const corruptData = [iv, tag, bytes.toString("base64")].join(":");
    expect(() => decryptSecret(corruptData)).toThrow();

    // Replace the auth tag with a different (valid-length) tag.
    const wrongTag = Buffer.alloc(16, 7).toString("base64");
    expect(() => decryptSecret([iv, wrongTag, data].join(":"))).toThrow();
  });

  it("keyHint returns the last 4 chars", () => {
    expect(keyHint("sk-ant-xyz9")).toBe("xyz9");
  });
});
