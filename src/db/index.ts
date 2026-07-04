import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

// Lazy init: la conexión solo se abre en el primer query, no al importar el
// módulo. Así `next build` (que no tiene DATABASE_URL) no revienta al recolectar
// las páginas; el error solo aparece si de verdad se intenta consultar sin config.
function getDb(): Database {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const client = postgres(connectionString, { prepare: false });
    instance = drizzle(client, { schema });
  }
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
