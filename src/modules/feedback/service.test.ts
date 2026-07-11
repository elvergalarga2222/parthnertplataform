import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTester } from "./service";

describe("isTester", () => {
  const original = process.env.ADMIN_EMAILS;
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("is true when the column is set", () => {
    expect(isTester({ isTester: true, email: "x@y.com" })).toBe(true);
  });

  it("is false for a regular partner", () => {
    expect(isTester({ isTester: false, email: "x@y.com" })).toBe(false);
  });

  it("is always true for ADMIN_EMAILS, even without the column set", () => {
    process.env.ADMIN_EMAILS = "op@x.com";
    expect(isTester({ isTester: false, email: "op@x.com" })).toBe(true);
    expect(isTester({ isTester: false, email: "OP@X.COM" })).toBe(true);
  });
});
