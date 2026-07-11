import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import {
  collaborators,
  companies,
  contacts,
  customFields,
  customFieldValues,
  deals,
  dealActivity,
  aiPrompts,
  budgetProjections,
  expenses,
  feedbackReports,
  invoices,
  kanbanCards,
  kanbanColumns,
  meetingAttendees,
  meetings,
  partners,
  pipelineStages,
  workspaceProfiles,
  workspaces,
} from "./schema";

// Demo seed for the CRM module. Idempotent: running it twice does not
// duplicate data. Creates (or reuses) a demo partner and fills its pipeline.
//
//   npm run db:seed

const DEMO_EMAIL = process.env.SEED_PARTNER_EMAIL ?? "demo@partnermanager.dev";

async function main() {
  const [existingPartner] = await db
    .select()
    .from(partners)
    .where(eq(partners.email, DEMO_EMAIL));

  const partner =
    existingPartner ??
    (
      await db
        .insert(partners)
        .values({
          // Mismo externalId que genera OpenMembershipProvider para que el
          // login por correo haga upsert sobre este partner y no choque con
          // el unique de email.
          skoolMemberId: `open_${DEMO_EMAIL}`,
          email: DEMO_EMAIL,
          displayName: "Partner Demo",
        })
        .returning()
    )[0];

  const partnerId = partner.id;
  console.log(`Seeding CRM data for partner ${DEMO_EMAIL} (${partnerId})`);

  const existingStages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.partnerId, partnerId));
  if (existingStages.length > 0) {
    console.log("Partner already has pipeline data; skipping CRM seed.");
    await seedWorkspaceDemo(partnerId);
    await seedGlobalAiPrompts();
    await seedFinanceDemo(partnerId);
    await seedFeedbackDemo(partnerId);
    await seedTeamDemo(partnerId);
    return;
  }

  const stageRows = await db
    .insert(pipelineStages)
    .values(
      [
        { name: "Descubrimiento", color: "purple" },
        // Gate de brief: clientes nuevos necesitan diagnóstico para entrar.
        { name: "Propuesta", color: "violet", requiresBrief: true },
        { name: "Negociación", color: "teal" },
        { name: "Cerrado Ganado", color: "green", isWon: true },
      ].map((s, i) => ({ ...s, partnerId, position: i })),
    )
    .returning();
  const stageByName = new Map(stageRows.map((s) => [s.name, s.id]));

  const companyRows = await db
    .insert(companies)
    .values(
      [
        { name: "Project Alfa", domain: "projectalfa.com", employees: 45 },
        { name: "Global Solutions", domain: "globalsolutions.io", employees: 120 },
        { name: "Clínica Vitalis", domain: "clinicavitalis.es", employees: 18 },
        { name: "Grupo Industrial Norte", domain: "ginorte.com", employees: 350 },
      ].map((c) => ({ ...c, partnerId })),
    )
    .returning();
  const companyByName = new Map(companyRows.map((c) => [c.name, c.id]));

  const contactRows = await db
    .insert(contacts)
    .values(
      [
        {
          fullName: "Leonardo Samsul",
          email: "leonardo@projectalfa.com",
          company: "Project Alfa",
        },
        {
          fullName: "Bayu Salto",
          email: "bayu@globalsolutions.io",
          company: "Global Solutions",
        },
        {
          fullName: "María Fernanda Ruiz",
          email: "mfruiz@clinicavitalis.es",
          company: "Clínica Vitalis",
        },
        {
          fullName: "Padhang Satrio",
          email: "padhang@ginorte.com",
          company: "Grupo Industrial Norte",
        },
      ].map(({ company, ...c }) => ({
        ...c,
        partnerId,
        companyId: companyByName.get(company) ?? null,
      })),
    )
    .returning();
  const contactByName = new Map(contactRows.map((c) => [c.fullName, c.id]));

  const today = new Date();
  const at = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  const dealSeeds = [
    {
      title: "Plataforma IA Integral",
      value: "35000",
      stage: "Negociación",
      company: "Project Alfa",
      contact: "Leonardo Samsul",
      fit: "excelente",
      nextActivity: "Llamada de cierre con dirección",
      nextActivityAt: at(0),
      brief:
        "Cliente nuevo del sector tech. Objetivo: plataforma integral con IA para operaciones. Presupuesto aprobado por dirección; decisor: Leonardo.",
    },
    {
      title: "Consultoría Cloud Pro",
      value: "18000",
      stage: "Propuesta",
      company: "Global Solutions",
      contact: "Bayu Salto",
      fit: "bueno",
      nextActivity: "Enviar propuesta revisada",
      nextActivityAt: at(0),
    },
    {
      title: "Sistema de Agenda Digital",
      value: "24000",
      stage: "Propuesta",
      company: "Clínica Vitalis",
      contact: "María Fernanda Ruiz",
      fit: "bueno",
      nextActivity: "Demo con el equipo médico",
      nextActivityAt: at(-1),
      brief:
        "Clínica con 3 sedes; agenda hoy en papel y WhatsApp. Objetivo: sistema de citas digital con recordatorios. Sensibles al precio.",
    },
    {
      title: "Consultoría Transformación Digital",
      value: "42000",
      stage: "Descubrimiento",
      company: "Grupo Industrial Norte",
      contact: "Padhang Satrio",
      fit: "medio",
      nextActivity: "Diagnóstico inicial",
      nextActivityAt: at(3),
    },
    {
      title: "Asesoría mensual growth",
      value: "1500",
      stage: "Cerrado Ganado",
      company: "Global Solutions",
      contact: "Bayu Salto",
      fit: "excelente",
      nextActivity: null,
      nextActivityAt: null,
    },
  ];

  const positionByStage = new Map<string, number>();
  const dealRows = [];
  for (const seed of dealSeeds) {
    const stageId = stageByName.get(seed.stage)!;
    const position = positionByStage.get(stageId) ?? 0;
    positionByStage.set(stageId, position + 1);
    const [row] = await db
      .insert(deals)
      .values({
        partnerId,
        title: seed.title,
        value: seed.value,
        stageId,
        companyId: companyByName.get(seed.company) ?? null,
        contactId: contactByName.get(seed.contact) ?? null,
        fit: seed.fit,
        nextActivity: seed.nextActivity,
        nextActivityAt: seed.nextActivityAt,
        brief: "brief" in seed ? seed.brief : null,
        position,
      })
      .returning();
    dealRows.push(row);
    await db.insert(dealActivity).values({
      dealId: row.id,
      type: "created",
      description: "Deal creado (seed)",
    });
  }

  const [sourceField] = await db
    .insert(customFields)
    .values({
      partnerId,
      entity: "deal",
      fieldKey: "fuente_del_lead",
      label: "Fuente del lead",
      fieldType: "select",
      options: ["Referido", "Instagram", "Web", "Evento"],
      position: 0,
    })
    .returning();

  await db.insert(customFieldValues).values(
    dealRows.slice(0, 3).map((deal, i) => ({
      customFieldId: sourceField.id,
      entityId: deal.id,
      value: ["Referido", "Instagram", "Web"][i],
    })),
  );

  console.log(
    `Seeded: ${stageRows.length} etapas, ${companyRows.length} empresas, ${contactRows.length} contactos, ${dealRows.length} deals, 1 campo custom.`,
  );

  await seedWorkspaceDemo(partnerId);
  await seedGlobalAiPrompts();
  await seedFinanceDemo(partnerId);
  await seedFeedbackDemo(partnerId);
  await seedTeamDemo(partnerId);

  // Sanity check for tenant scoping: nothing from this partner should be
  // visible when filtering by a different partner id.
  const [foreign] = await db
    .select()
    .from(deals)
    .where(
      and(
        eq(deals.partnerId, "00000000-0000-0000-0000-000000000000"),
        eq(deals.title, dealSeeds[0].title),
      ),
    );
  if (foreign) throw new Error("Tenant scoping check failed");
}

// Global AI system prompts (partner_id NULL = system template, editable only
// by admin). Idempotent by (type, name).
async function seedGlobalAiPrompts() {
  const seeds: {
    type: "guion" | "estrategia" | "diagnostico";
    name: string;
    systemPrompt: string;
  }[] = [
    {
      type: "guion",
      name: "Guion de retención (Reels/TikTok)",
      systemPrompt:
        "Eres un guionista experto en video corto para marca personal. A partir del producto/ángulo que te den, escribe un guion con hook en los primeros 3 segundos, desarrollo con retención y un CTA claro. Formato: HOOK / DESARROLLO / CTA. Español, tono directo.",
    },
    {
      type: "estrategia",
      name: "Estrategia SOBA (Segmento-Oferta-Vehículo-Atención)",
      systemPrompt:
        "Eres un estratega de negocios de servicios. A partir del contexto del cliente, propón una estrategia usando el marco SOBA: Segmento (a quién), Oferta (transformación A→B), Vehículo (cómo se entrega) y Atención (cómo se atrae). Devuelve cada sección con recomendaciones accionables.",
    },
    {
      type: "diagnostico",
      name: "Copiloto de diagnóstico",
      systemPrompt:
        "Eres un copiloto de diagnóstico de negocios. Haz preguntas una a una para entender el negocio del cliente (modelo, oferta, canales, cuellos de botella). Cuando tengas suficiente contexto, entrega un diagnóstico con los 3 problemas prioritarios y una recomendación por cada uno. No inventes datos: si falta información, pregúntala.",
    },
  ];

  for (const seed of seeds) {
    const [existing] = await db
      .select({ id: aiPrompts.id })
      .from(aiPrompts)
      .where(and(isNull(aiPrompts.partnerId), eq(aiPrompts.name, seed.name)));
    if (existing) continue;
    await db.insert(aiPrompts).values({
      partnerId: null,
      type: seed.type,
      name: seed.name,
      systemPrompt: seed.systemPrompt,
    });
  }
  console.log(`Global AI prompts ensured (${seeds.length}).`);
}

// Idempotent workspace demo: backfills workspaces for won deals created
// before the trigger existed, and fills the first empty workspace with demo
// cards + a SOP so the module has something to show.
async function seedWorkspaceDemo(partnerId: string) {
  const DEFAULT_COLS = ["Por hacer", "En proceso", "En estancamiento", "Hecho"];

  const wonDealsWithoutWs = await db
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .leftJoin(workspaces, eq(workspaces.dealId, deals.id))
    .where(
      and(
        eq(deals.partnerId, partnerId),
        eq(pipelineStages.isWon, true),
        isNull(workspaces.id),
      ),
    );

  for (const deal of wonDealsWithoutWs) {
    const [ws] = await db
      .insert(workspaces)
      .values({ partnerId, dealId: deal.id, clientName: deal.title })
      .onConflictDoNothing({ target: workspaces.dealId })
      .returning({ id: workspaces.id });
    if (!ws) continue;
    await db.insert(workspaceProfiles).values({ workspaceId: ws.id });
    await db.insert(kanbanColumns).values(
      DEFAULT_COLS.map((name, i) => ({ workspaceId: ws.id, name, position: i })),
    );
    console.log(`Workspace backfilled for won deal "${deal.title}".`);
  }

  const [emptyWs] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.partnerId, partnerId),
        sql`NOT EXISTS (SELECT 1 FROM kanban_cards kc WHERE kc.workspace_id = ${workspaces.id})`,
      ),
    )
    .limit(1);
  if (!emptyWs) return;

  const cols = await db
    .select()
    .from(kanbanColumns)
    .where(eq(kanbanColumns.workspaceId, emptyWs.id))
    .orderBy(kanbanColumns.position);
  if (cols.length === 0) return;

  const colByName = new Map(cols.map((c) => [c.name, c.id]));
  const fallback = cols[0].id;
  const cardSeeds = [
    { title: "Kickoff con el cliente", col: "Hecho", assignee: "Partner Demo" },
    { title: "Auditoría de presencia digital", col: "En proceso", assignee: "Partner Demo" },
    { title: "Configurar píxel y analítica", col: "Por hacer", assignee: null },
    { title: "Plan de contenidos mes 1", col: "Por hacer", assignee: null },
  ];
  await db.insert(kanbanCards).values(
    cardSeeds.map((c, i) => ({
      workspaceId: emptyWs.id,
      columnId: colByName.get(c.col) ?? fallback,
      title: c.title,
      assignee: c.assignee,
      position: i,
    })),
  );

  await db
    .update(kanbanColumns)
    .set({
      sopContent:
        "1. Revisar el brief del cliente y accesos.\n2. Priorizar tareas de mayor impacto en facturación.\n3. Toda tarea debe tener responsable y fecha antes de pasar a «En proceso».",
    })
    .where(eq(kanbanColumns.id, cols[0].id));

  // Estrategia demo para el export (idempotente: solo si sigue vacía).
  await db
    .update(workspaceProfiles)
    .set({
      strategyDoc:
        "# Estrategia de crecimiento\n\nObjetivo: duplicar la facturación mensual del cliente en 6 meses apoyándose en contenido orgánico y automatización comercial.\n\n## Fases\n- Auditoría de presencia digital y embudo actual\n- Implementación de píxel, analítica y CRM\n- Plan de contenidos mes a mes con foco en **video corto**\n\n## Métricas clave\n- Leads calificados por semana\n- Tasa de cierre del pipeline\n- Costo por adquisición",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceProfiles.workspaceId, emptyWs.id),
        isNull(workspaceProfiles.strategyDoc),
      ),
    );

  console.log("Workspace demo cards + SOP seeded.");
}

// Idempotent finance demo (Fase 4): sets the demo partner's currency to EUR (to
// match the existing demo deals so all 3 KPIs are coherent) and seeds paid
// invoices across recent months (revenue trend), pending invoices near/past due
// (topbar alerts), expenses across the real categories, a monthly budget, and a
// single USD invoice via external_ref to exercise the multi-currency/webhook path.
async function seedFinanceDemo(partnerId: string) {
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.partnerId, partnerId))
    .limit(1);
  if (existing) {
    console.log("Partner already has finance data; skipping finance seed.");
    return;
  }

  await db
    .update(partners)
    .set({ defaultCurrency: "EUR", updatedAt: new Date() })
    .where(eq(partners.id, partnerId));

  const now = new Date();
  // Mid-month date N months back (avoids month-boundary drift in date_trunc).
  const monthDate = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15));
  // A date `days` from today (UTC) as YYYY-MM-DD.
  const dayISO = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const firstOfMonthISO = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);

  // Paid invoices → v_monthly_revenue trend (EUR). kind mezcla ~75/25
  // proyecto/asesoría para que la regla 70/30 tenga datos reales.
  const paidByMonth = [
    { offset: -5, amount: "30000", client: "Global Solutions", kind: "proyecto" as const },
    { offset: -4, amount: "34000", client: "Clínica Vitalis", kind: "proyecto" as const },
    { offset: -3, amount: "32000", client: "Project Alfa", kind: "asesoria_mensual" as const },
    { offset: -2, amount: "40000", client: "Grupo Industrial Norte", kind: "proyecto" as const },
    { offset: -1, amount: "48000", client: "Global Solutions", kind: "proyecto" as const },
    { offset: 0, amount: "52000", client: "Project Alfa", kind: "asesoria_mensual" as const },
  ];
  const paidInvoices = paidByMonth.map((p) => {
    const d = monthDate(p.offset);
    return {
      partnerId,
      clientName: p.client,
      description:
        p.kind === "asesoria_mensual" ? "Asesoría mensual" : "Proyecto — hito",
      amount: p.amount,
      currency: "EUR" as const,
      status: "pagado" as const,
      kind: p.kind,
      issuedAt: d.toISOString().slice(0, 10),
      paidAt: d,
    };
  });

  // Open invoices → topbar alerts (overdue + near-due).
  const openInvoices = [
    {
      partnerId,
      clientName: "Clínica Vitalis",
      description: "Fase 2 — implementación",
      amount: "12000",
      currency: "EUR" as const,
      status: "pendiente" as const,
      issuedAt: dayISO(-20),
      dueDate: dayISO(-6), // overdue (dynamic)
    },
    {
      partnerId,
      clientName: "Grupo Industrial Norte",
      description: "Consultoría — hito 1",
      amount: "18000",
      currency: "EUR" as const,
      status: "vencido" as const,
      issuedAt: dayISO(-30),
      dueDate: dayISO(-12), // explicitly overdue
    },
    {
      partnerId,
      clientName: "Global Solutions",
      description: "Growth mensual",
      amount: "1500",
      currency: "EUR" as const,
      status: "pendiente" as const,
      issuedAt: dayISO(-5),
      dueDate: dayISO(2), // near-due (within 3 days)
    },
    {
      partnerId,
      clientName: "Project Alfa",
      description: "Ampliación de alcance",
      amount: "9000",
      currency: "EUR" as const,
      status: "pendiente" as const,
      issuedAt: dayISO(-2),
      dueDate: dayISO(25), // future, not an alert
    },
  ];

  // One USD invoice created "by the automation" (external_ref) — demonstrates
  // multi-currency: it does NOT appear in the EUR dashboard KPI.
  const usdInvoice = {
    partnerId,
    clientName: "Overseas Client LLC",
    description: "Sprint de estrategia (pago vía n8n)",
    amount: "2500",
    currency: "USD" as const,
    status: "pagado" as const,
    issuedAt: monthDate(0).toISOString().slice(0, 10),
    paidAt: monthDate(0),
    externalRef: `n8n-demo-${partnerId.slice(0, 8)}`,
  };

  await db.insert(invoices).values([...paidInvoices, ...openInvoices, usdInvoice]);

  // Expenses across the real categories (EUR), this month + prior.
  await db.insert(expenses).values([
    { partnerId, category: "ia", description: "Anthropic / OpenAI", amount: "180", currency: "EUR", incurredAt: dayISO(-3) },
    { partnerId, category: "produccion_video", description: "Higgsfield + Kling + ElevenLabs", amount: "320", currency: "EUR", incurredAt: dayISO(-8) },
    { partnerId, category: "hosting_vps", description: "VPS + CDN", amount: "95", currency: "EUR", incurredAt: dayISO(-10) },
    { partnerId, category: "freelancer", description: "Editor de video freelance", amount: "1200", currency: "EUR", incurredAt: dayISO(-14) },
    { partnerId, category: "herramientas_saas", description: "CapCut Pro + Notion + Figma", amount: "140", currency: "EUR", incurredAt: dayISO(-6) },
    { partnerId, category: "otro", description: "Gastos varios", amount: "75", currency: "EUR", incurredAt: dayISO(-2) },
    { partnerId, category: "produccion_video", description: "Banco de música/stock", amount: "60", currency: "EUR", incurredAt: monthDate(-1).toISOString().slice(0, 10) },
  ]);

  // Monthly budget/projection for the current month (EUR).
  await db.insert(budgetProjections).values({
    partnerId,
    month: firstOfMonthISO,
    projectedRevenue: "60000",
    budgetExpenses: "15000",
    targetProfit: "35000",
    currency: "EUR",
  });

  console.log(
    `Finance demo seeded: ${paidInvoices.length} facturas pagadas, ${openInvoices.length} pendientes/vencidas, 1 factura USD (n8n), 7 gastos, 1 presupuesto.`,
  );
}

// Idempotent tester demo (PR-15): marca al partner demo como tester y siembra
// 2 reportes de ejemplo (1 bug nuevo, 1 sugerencia revisada).
async function seedFeedbackDemo(partnerId: string) {
  await db
    .update(partners)
    .set({ isTester: true, updatedAt: new Date() })
    .where(and(eq(partners.id, partnerId), eq(partners.isTester, false)));

  const [existing] = await db
    .select({ id: feedbackReports.id })
    .from(feedbackReports)
    .where(eq(feedbackReports.partnerId, partnerId))
    .limit(1);
  if (existing) {
    console.log("Partner already has feedback reports; skipping feedback seed.");
    return;
  }

  await db.insert(feedbackReports).values([
    {
      partnerId,
      route: "/clientes",
      type: "bug",
      description:
        "Al mover un deal a la etapa Propuesta sin llenar el brief, el error se ve genérico en vez de explicar qué falta.",
      status: "nuevo",
      userAgent: "Mozilla/5.0 (seed demo)",
    },
    {
      partnerId,
      route: "/partner-business",
      type: "sugerencia",
      description:
        "Sería útil poder exportar la tabla de facturas a CSV directamente desde el filtro activo.",
      status: "revisado",
      userAgent: "Mozilla/5.0 (seed demo)",
    },
  ]);

  console.log("Feedback demo seeded: partner marcado tester, 2 reportes.");
}

async function seedTeamDemo(partnerId: string) {
  const [existing] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(eq(collaborators.partnerId, partnerId))
    .limit(1);
  if (existing) {
    console.log("Partner already has team data; skipping team seed.");
    return;
  }

  const [editorRow] = await db
    .insert(collaborators)
    .values({
      partnerId,
      email: "editora.demo@partnermanager.dev",
      displayName: "Camila Reyes",
      roleTitle: "Head of Sales",
      permission: "editor",
      status: "activo",
      acceptedAt: new Date(),
      lastLoginAt: new Date(),
    })
    .returning({ id: collaborators.id });

  // Invitación pendiente: token demo (nunca en claro fuera de un seed local).
  const pendingToken = "demo-pending-invite-token";
  await db.insert(collaborators).values({
    partnerId,
    email: "pendiente.demo@partnermanager.dev",
    roleTitle: "Operaciones",
    permission: "lector",
    status: "invitado",
    inviteTokenHash: createHash("sha256").update(pendingToken).digest("hex"),
    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const [meetingRow] = await db
    .insert(meetings)
    .values({
      partnerId,
      title: "Sync semanal de equipo",
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      durationMinutes: 30,
      note: "Revisar pipeline de la semana y bloqueos activos.",
    })
    .returning({ id: meetings.id });

  await db.insert(meetingAttendees).values([
    { meetingId: meetingRow.id, collaboratorId: null }, // el partner
    { meetingId: meetingRow.id, collaboratorId: editorRow.id },
  ]);

  console.log("Team demo seeded: 2 colaboradores (1 editor activo, 1 invitación pendiente), 1 reunión.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
