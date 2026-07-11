// PM2 para ambos entornos (producción y staging) en el mismo VPS, aislados
// por cwd/puerto/BD/Redis DB lógica — ver docs/STAGING.md. Las envs de cada
// app salen de un .env local a su propio cwd (NUNCA de este archivo
// versionado: el repo no lleva secretos). El standalone de Next requiere
// haber copiado .next/static y public/ dentro de .next/standalone antes de
// arrancar (lo hacen deploy-staging.sh / deploy-prod.sh) — ver Dockerfile
// para el mismo patrón ya usado en el flujo Docker (no vigente en prod, pero
// la forma de armar el standalone es la misma).
module.exports = {
  apps: [
    {
      name: "pm-web",
      cwd: "/opt/partner-manager",
      script: ".next/standalone/server.js",
      env: { PORT: 3000, NODE_ENV: "production" },
    },
    {
      name: "pm-jobs",
      cwd: "/opt/partner-manager",
      script: "node_modules/.bin/tsx",
      args: "src/jobs/index.ts",
      env: { NODE_ENV: "production" },
    },
    {
      name: "pm-web-staging",
      cwd: "/opt/partner-manager-staging",
      script: ".next/standalone/server.js",
      env: { PORT: 3100, NODE_ENV: "production" },
    },
    {
      name: "pm-jobs-staging",
      cwd: "/opt/partner-manager-staging",
      script: "node_modules/.bin/tsx",
      args: "src/jobs/index.ts",
      env: { NODE_ENV: "production" },
    },
  ],
};
