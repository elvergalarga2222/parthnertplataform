import { getDb } from "./index";
import { industries, sopTemplates } from "./schema";

// Catálogo cerrado de industrias mainstream (regla de negocio #5).
const MAINSTREAM_INDUSTRIES = [
  "Médicos y clínicas",
  "Odontología",
  "Estéticas y belleza",
  "Fitness y gimnasios",
  "Restaurantes y gastronomía",
  "Inmobiliario",
  "Construcción y remodelación",
  "Industrial y manufactura",
  "Logística y transporte",
  "Educación y academias",
  "Legal y contable",
  "Tecnología y software",
  "Retail y e-commerce",
  "Turismo y hotelería",
  "Automotriz",
  "Agencias de marketing",
  "Seguros y finanzas",
  "Veterinarias y mascotas",
];

// SOPs y prompts que se inyectan al abrir cada workspace (Épica 3).
const SOP_TEMPLATES = [
  {
    title: "SOP 1 — Diagnóstico inicial del negocio",
    kind: "sop",
    phase: "diagnostico",
    sortOrder: 10,
    body: "1. Agenda la sesión de diagnóstico (60–90 min) con el dueño.\n2. Levanta: facturación mensual, margen, fuentes de clientes actuales, capacidad instalada.\n3. Identifica el cuello de botella principal (captación, conversión o entrega).\n4. Documenta el Punto A del cliente con números, no con opiniones.\n5. Valida con el cliente el Punto B deseado a 90 días.",
  },
  {
    title: "Prompt IA — Preparar diagnóstico",
    kind: "ai_prompt",
    phase: "diagnostico",
    sortOrder: 20,
    body: "Actúa como consultor de negocios. Con estos datos del cliente [pegar datos del diagnóstico], identifica: (1) el cuello de botella principal de rentabilidad, (2) tres palancas de mejora ordenadas por impacto/esfuerzo, (3) los riesgos de cada una. Formato: tabla + resumen ejecutivo de 5 líneas.",
  },
  {
    title: "SOP 2 — Kickoff y plan de implementación",
    kind: "sop",
    phase: "implementacion",
    sortOrder: 30,
    body: "1. Presenta el plan de 90 días dividido en sprints quincenales.\n2. Carga las tareas del sprint 1 en el kanban y marca cuáles verá el cliente.\n3. Comparte la Vista de Cliente para que audite el progreso.\n4. Define el canal y la cadencia de reporte (semanal recomendado).",
  },
  {
    title: "SOP 3 — Reporte quincenal de avance",
    kind: "sop",
    phase: "implementacion",
    sortOrder: 40,
    body: "1. Revisa el kanban: mueve tareas estancadas y documenta el porqué.\n2. Actualiza métricas del cliente vs. Punto B.\n3. Envía resumen: hecho, en curso, bloqueado, siguiente.\n4. Agenda la siguiente revisión antes de cerrar la llamada.",
  },
  {
    title: "Prompt IA — Guion de presentación de resultados",
    kind: "ai_prompt",
    phase: "entrega",
    sortOrder: 50,
    body: "Con estos avances [pegar lista de tareas finalizadas y métricas], redacta un guion de 10 minutos para presentar resultados al cliente: gancho inicial con el logro más tangible, narrativa Punto A → Punto B, y cierre con próximos pasos que refuercen la continuidad del servicio.",
  },
];

async function seed() {
  const db = getDb();
  for (const name of MAINSTREAM_INDUSTRIES) {
    await db.insert(industries).values({ name }).onConflictDoNothing();
  }
  console.log(`Seeded ${MAINSTREAM_INDUSTRIES.length} industries.`);

  for (const tpl of SOP_TEMPLATES) {
    await db.insert(sopTemplates).values(tpl).onConflictDoNothing();
  }
  console.log(`Seeded ${SOP_TEMPLATES.length} SOP templates.`);
}

seed().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
