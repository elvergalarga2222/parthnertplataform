import { describe, expect, it } from "vitest";
import { DevMembershipProvider } from "./dev-provider";

describe("DevMembershipProvider", () => {
  const provider = new DevMembershipProvider([
    "Partner@Example.com",
    " otro@example.com ",
  ]);

  it("normaliza y encuentra por email (case-insensitive, sin espacios)", async () => {
    const member = await provider.findMemberByEmail("partner@example.com");
    expect(member).not.toBeNull();
    expect(member?.email).toBe("partner@example.com");
    expect(member?.status).toBe("active");
  });

  it("devuelve null para emails desconocidos (no hay registro manual)", async () => {
    expect(await provider.findMemberByEmail("nadie@example.com")).toBeNull();
  });

  it("lista todos los miembros activos", async () => {
    const active = await provider.listActiveMembers();
    expect(active).toHaveLength(2);
    expect(active.map((m) => m.email)).toContain("otro@example.com");
  });
});
