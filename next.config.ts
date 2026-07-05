import type { NextConfig } from "next";
import path from "node:path";

// Server Actions validan que el Origin de la petición coincida con el Host.
// Detrás de un reverse proxy (Nginx) con un dominio nuevo, si las cabeceras no
// coinciden exactamente, Next rechaza TODA mutación con "x-forwarded-host does
// not match origin". Declarar el/los dominios de producto evita ese fallo.
//
// Configurable por env (sin recompilar al cambiar de dominio):
//   ALLOWED_ORIGINS="deno.arenacatticos.store,arenacatticos.store"
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  // Raíz de tracing explícita para que el bundle standalone sea determinista
  // (evita que Next infiera mal la raíz si hay lockfiles anidados).
  outputFileTracingRoot: path.join(process.cwd()),
  experimental: {
    serverActions: {
      allowedOrigins:
        allowedOrigins.length > 0
          ? allowedOrigins
          : [
              // Defaults conocidos para el cambio de dominio en curso; se
              // sobreescriben con ALLOWED_ORIGINS en el entorno.
              "deno.arenacatticos.store",
              "arenacatticos.store",
            ],
    },
  },
};

export default nextConfig;
