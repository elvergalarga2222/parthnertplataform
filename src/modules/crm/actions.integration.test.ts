import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Verifica el enforcement de permisos de PR-8 (requireEditor) en las actions
// de CRM: un colaborador `lector` no puede mutar, un `editor` sí. Necesita
// Postgres + Redis (la sesión de colaborador vive en Redis).
const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));
// revalidatePath requiere el store de generación estática de un request real
// de Next — ausente al llamar la action directamente desde un test.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe.skipIf(!hasDb)("crm actions — requireEditor enforcement (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let crmActions: typeof import("./actions");
  let crmService: typeof import("./service");
  let sessionMod: typeof import("@/modules/auth/session");

  let partnerId: string;
  let stageId: string;
  let lectorId: string;
  let editorId: string;

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    crmActions = await import("./actions");
    crmService = await import("./service");
    sessionMod = await import("@/modules/auth/session");

    const [partner] = await db
      .insert(schema.partners)
      .values({
        skoolMemberId: `test:${randomUUID()}`,
        email: `test-crm-perms-${randomUUID()}@test.dev`,
        displayName: "Test CRM Perms",
      })
      .returning({ id: schema.partners.id });
    partnerId = partner.id;
    const stage = await crmService.createStage(partnerId, { name: "Etapa", color: "gray" });
    stageId = stage.id;

    const [lector] = await db
      .insert(schema.collaborators)
      .values({
        partnerId,
        email: `lector-${randomUUID()}@test.dev`,
        displayName: "Lector",
        permission: "lector",
        status: "activo",
      })
      .returning({ id: schema.collaborators.id });
    lectorId = lector.id;

    const [editor] = await db
      .insert(schema.collaborators)
      .values({
        partnerId,
        email: `editor-${randomUUID()}@test.dev`,
        displayName: "Editor",
        permission: "editor",
        status: "activo",
      })
      .returning({ id: schema.collaborators.id });
    editorId = editor.id;
  });

  afterAll(async () => {
    if (!hasDb || !partnerId) return;
    const { eq, inArray } = await import("drizzle-orm");
    const dealRows = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.partnerId, partnerId));
    if (dealRows.length) {
      await db.delete(schema.dealActivity).where(inArray(schema.dealActivity.dealId, dealRows.map((d) => d.id)));
    }
    await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
    await db.delete(schema.pipelineStages).where(eq(schema.pipelineStages.partnerId, partnerId));
    await db.delete(schema.collaborators).where(eq(schema.collaborators.partnerId, partnerId));
    await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
  });

  it("rejects createDealAction for a lector collaborator", async () => {
    await sessionMod.createCollaboratorSession(partnerId, lectorId);
    const result = await crmActions.createDealAction({
      title: "Deal de prueba",
      value: 100,
      stageId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no autorizado/i);
  });

  it("allows createDealAction for an editor collaborator", async () => {
    await sessionMod.createCollaboratorSession(partnerId, editorId);
    const result = await crmActions.createDealAction({
      title: "Deal creado por editor",
      value: 100,
      stageId,
    });
    expect(result.ok).toBe(true);
  });
});
