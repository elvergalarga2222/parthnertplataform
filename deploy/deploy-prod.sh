#!/usr/bin/env bash
# Deploy de producción — corre en el VPS. Se niega a correr sin tag:
# producción nunca despliega una rama, solo un commit ya probado en staging.
#
# Uso: deploy/deploy-prod.sh <tag>   (p. ej. v0.4)
# Rollback: deploy/deploy-prod.sh <tag-anterior> — un rollback es solo otro deploy.
set -euo pipefail

TAG="${1:?Uso: deploy/deploy-prod.sh <tag> — producción no deploya ramas, solo tags ya probados en staging.}"

APP_DIR="/opt/partner-manager"
PORT=3000
REPO_URL="https://github.com/elvergalarga2222/parthnertplataform.git"

echo "==> Deploy producción — tag ${TAG} — $(date -u +%FT%TZ)"

# 1. Código: exactamente el tag pedido.
if [ -d "$APP_DIR/.git" ]; then
  echo "-> Actualizando código en $APP_DIR"
  git -C "$APP_DIR" fetch origin --tags
  git -C "$APP_DIR" checkout "$TAG"
else
  echo "-> Clonando repositorio en $APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  git -C "$APP_DIR" fetch origin --tags
  git -C "$APP_DIR" checkout "$TAG"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "ERROR: falta $APP_DIR/.env de producción." >&2
  exit 1
fi

# 2. Dependencias + build.
echo "-> npm ci"
npm ci
echo "-> npm run build"
npm run build

echo "-> Copiando static/public al standalone"
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Migraciones — contra la BD de producción. Ya se corrieron y probaron
# contra la BD de staging con este mismo commit antes de llegar aquí.
echo "-> Migraciones (BD de producción)"
npm run db:migrate

# Sin seed en producción.

# 4. PM2.
echo "-> pm2 restart"
if pm2 describe pm-web >/dev/null 2>&1; then
  pm2 restart pm-web pm-jobs --update-env
else
  pm2 start ecosystem.config.js --only pm-web,pm-jobs
fi
pm2 save

# 5. Smoke test.
echo "-> Smoke test"
"$APP_DIR/deploy/smoke.sh" "$PORT"

echo "==> Deploy producción OK (${TAG})."
