import { getDb } from "./index";
import { industries } from "./schema";

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

async function seed() {
  const db = getDb();
  for (const name of MAINSTREAM_INDUSTRIES) {
    await db.insert(industries).values({ name }).onConflictDoNothing();
  }
  console.log(`Seeded ${MAINSTREAM_INDUSTRIES.length} industries.`);
}

seed().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
