import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Raíz de tracing explícita para que el bundle standalone sea determinista
  // (evita que Next infiera mal la raíz si hay lockfiles anidados).
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
