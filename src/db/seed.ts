import { and, eq } from "drizzle-orm";
import { db } from "./index";
import {
  companies,
  contacts,
  customFields,
  customFieldValues,
  deals,
  dealActivity,
  partners,
  pipelineStages,
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
    console.log("Partner already has pipeline data; nothing to do.");
    return;
  }

  const stageRows = await db
    .insert(pipelineStages)
    .values(
      [
        { name: "Descubrimiento", color: "purple" },
        { name: "Propuesta", color: "violet" },
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

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
