import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("feedback service (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let feedback: typeof import("./service");
  let admin: typeof import("@/modules/admin/service");

  let partnerA: string;
  let partnerB: string;
  const createdPartners: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    feedback = await import("./service");
    admin = await import("@/modules/admin/service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-feedback-${label}-${randomUUID()}@test.dev`,
          displayName: `Test Feedback ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { eq } = await import("drizzle-orm");
    for (const partnerId of createdPartners) {
      await db
        .delete(schema.feedbackReports)
        .where(eq(schema.feedbackReports.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("creates a report scoped to the given partner with route/type/description", async () => {
    const id = await feedback.createFeedback(partnerA, {
      route: "/clientes?x=1",
      type: "bug",
      description: "Algo se rompió al mover el deal.",
      userAgent: "test-agent",
    });
    expect(id).toBeTruthy();

    const rows = await admin.listFeedbackReports();
    const created = rows.find((r) => r.id === id);
    expect(created).toBeDefined();
    expect(created!.route).toBe("/clientes?x=1");
    expect(created!.type).toBe("bug");
    expect(created!.status).toBe("nuevo");
  });

  it("rejects a duplicate description from the same partner within 30s", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    await feedback.createFeedback(
      partnerA,
      { route: "/dashboard", type: "sugerencia", description: "Texto idéntico." },
      now,
    );
    await expect(
      feedback.createFeedback(
        partnerA,
        { route: "/dashboard", type: "sugerencia", description: "Texto idéntico." },
        new Date(now.getTime() + 5000),
      ),
    ).rejects.toThrow(/hace un momento/);

    // Pasada la ventana, sí se permite de nuevo.
    const idAfter = await feedback.createFeedback(
      partnerA,
      { route: "/dashboard", type: "sugerencia", description: "Texto idéntico." },
      new Date(now.getTime() + 31_000),
    );
    expect(idAfter).toBeTruthy();
  });

  it("admin can filter reports by status and type; setFeedbackStatus persists", async () => {
    const id = await feedback.createFeedback(partnerB, {
      route: "/tareas",
      type: "bug",
      description: "Otro bug de B para filtrar.",
    });

    const bugsOnly = await admin.listFeedbackReports({ type: "bug" });
    expect(bugsOnly.every((r) => r.type === "bug")).toBe(true);
    expect(bugsOnly.some((r) => r.id === id)).toBe(true);

    await admin.setFeedbackStatus(id, "resuelto");
    const after = await admin.listFeedbackReports({ status: "resuelto" });
    expect(after.some((r) => r.id === id && r.status === "resuelto")).toBe(true);
  });

  it("countNewFeedbackReports reflects only status='nuevo'", async () => {
    const before = await admin.countNewFeedbackReports();
    const id = await feedback.createFeedback(partnerA, {
      route: "/equipo",
      type: "bug",
      description: "Cuenta de nuevos, reporte fresco.",
    });
    expect(await admin.countNewFeedbackReports()).toBe(before + 1);
    await admin.setFeedbackStatus(id, "revisado");
    expect(await admin.countNewFeedbackReports()).toBe(before);
  });

  it("setTester toggles the flag and is reflected in listPartners", async () => {
    await admin.setTester(partnerA, true);
    let rows = await admin.listPartners();
    expect(rows.find((p) => p.id === partnerA)?.isTester).toBe(true);

    await admin.setTester(partnerA, false);
    rows = await admin.listPartners();
    expect(rows.find((p) => p.id === partnerA)?.isTester).toBe(false);
  });

  it("setFeedbackStatus on an unknown report throws", async () => {
    await expect(
      admin.setFeedbackStatus(randomUUID(), "revisado"),
    ).rejects.toThrow(/no encontrado/);
  });
});
