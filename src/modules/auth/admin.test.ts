import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("fails closed when ADMIN_EMAILS is unset or empty", () => {
    expect(isAdminEmail("op@x.com")).toBe(false);
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("op@x.com")).toBe(false);
    process.env.ADMIN_EMAILS = " , ,";
    expect(isAdminEmail("op@x.com")).toBe(false);
  });

  it("matches case-insensitively and ignores whitespace", () => {
    process.env.ADMIN_EMAILS = " Op@X.com , otra@y.com ";
    expect(isAdminEmail("op@x.com")).toBe(true);
    expect(isAdminEmail("OP@X.COM ")).toBe(true);
    expect(isAdminEmail("otra@y.com")).toBe(true);
    expect(isAdminEmail("nadie@z.com")).toBe(false);
  });
});
