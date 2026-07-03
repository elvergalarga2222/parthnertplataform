import { describe, expect, it } from "vitest";
import type { Member, MembershipProvider } from "./membership-provider";

class FakeProvider implements MembershipProvider {
  constructor(private members: Member[]) {}

  async findMemberByEmail(email: string) {
    return this.members.find((m) => m.email === email) ?? null;
  }

  async listActiveMembers() {
    return this.members.filter((m) => m.status === "active");
  }
}

describe("MembershipProvider contract", () => {
  const active: Member = {
    externalId: "sk_1",
    email: "partner@example.com",
    displayName: "Partner Uno",
    status: "active",
  };
  const churned: Member = {
    externalId: "sk_2",
    email: "churned@example.com",
    displayName: null,
    status: "churned",
  };

  it("finds a member by email", async () => {
    const provider = new FakeProvider([active, churned]);
    expect(await provider.findMemberByEmail("partner@example.com")).toEqual(
      active,
    );
  });

  it("returns null for unknown emails (no manual registration)", async () => {
    const provider = new FakeProvider([active]);
    expect(await provider.findMemberByEmail("nobody@example.com")).toBeNull();
  });

  it("lists only active members for the polling job", async () => {
    const provider = new FakeProvider([active, churned]);
    expect(await provider.listActiveMembers()).toEqual([active]);
  });
});
