#!/usr/bin/env bash
# Deploy de staging — corre en el VPS. Idempotente: correrlo dos veces
# seguidas no debe cambiar nada más allá de un no-op estable.
#
# Despliega SIEMPRE la rama main HEAD (el flujo de promoción vive en
# deploy-prod.sh, que despliega un tag ya probado aquí). Ver docs/STAGING.md.
set -euo pipefail

APP_DIR="/opt/partner-manager-staging"
PORT=3100
REPO_URL="https://github.com/elvergalarga2222/parthnertplataform.git"

echo "==> Deploy staging — $(date -u +%FT%TZ)"

# 1. Código: main HEAD.
if [ -d "$APP_DIR/.git" ]; then
  echo "-> Actualizando código en $APP_DIR"
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  echo "-> Clonando repositorio en $APP_DIR"
  git clone --branch main "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: falta $APP_DIR/.env — sigue el runbook en docs/STAGING.md antes del primer deploy." >&2
  exit 1
fi

# 2. Dependencias + build.
echo "-> npm ci"
npm ci
echo "-> npm run build"
npm run build

# El standalone de Next necesita static/public copiados a mano dentro de
# .next/standalone (mismo patrón que el Dockerfile del flujo Docker, no
# vigente en prod pero correcto para armar el standalone).
echo "-> Copiando static/public al standalone"
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Migraciones — SOLO contra la BD de staging (aquí es donde una migración
# rota explota sin tocar producción).
echo "-> Migraciones (BD de staging)"
npm run db:migrate

# 4. Seed idempotente — únicamente datos demo, nunca dumps de producción.
echo "-> Seed (idempotente)"
npm run db:seed

# 5. PM2.
echo "-> pm2 restart"
if pm2 describe pm-web-staging >/dev/null 2>&1; then
  pm2 restart pm-web-staging pm-jobs-staging --update-env
else
  pm2 start ecosystem.config.js --only pm-web-staging,pm-jobs-staging
fi
pm2 save

# 6. Smoke test — si falla, el deploy se considera roto.
echo "-> Smoke test"
"$APP_DIR/deploy/smoke.sh" "$PORT"

echo "==> Deploy staging OK."
