import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { membershipGraceDays } from "./membership-sync";

// Cobertura pura de membershipGraceDays; syncMemberships en sí necesita
// Postgres real (escribe skool_memberships/access_audit_log) y se cubre en
// membership-sync.integration.test.ts con el patrón dev-provider.test.ts.

describe("membershipGraceDays", () => {
  const original = process.env.MEMBERSHIP_GRACE_DAYS;
  beforeEach(() => {
    delete process.env.MEMBERSHIP_GRACE_DAYS;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.MEMBERSHIP_GRACE_DAYS;
    else process.env.MEMBERSHIP_GRACE_DAYS = original;
  });

  it("defaults to 15 when unset or invalid", () => {
    expect(membershipGraceDays()).toBe(15);
    process.env.MEMBERSHIP_GRACE_DAYS = "abc";
    expect(membershipGraceDays()).toBe(15);
    process.env.MEMBERSHIP_GRACE_DAYS = "-3";
    expect(membershipGraceDays()).toBe(15);
    process.env.MEMBERSHIP_GRACE_DAYS = "0";
    expect(membershipGraceDays()).toBe(15);
  });

  it("uses the configured integer value", () => {
    process.env.MEMBERSHIP_GRACE_DAYS = "7";
    expect(membershipGraceDays()).toBe(7);
  });
});
