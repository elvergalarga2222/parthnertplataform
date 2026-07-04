#!/usr/bin/env bash
# Partner Manager — instalación/actualización en VPS.
#
# Uso (como root en el VPS):
#   curl -fsSL https://raw.githubusercontent.com/elvergalarga2222/parthnertplataform/claude/partner-manager-requirements-r11zzp/deploy/vps-setup.sh | bash
#
# Es idempotente: la primera vez instala, las siguientes actualiza.
# NO toca configuraciones existentes del servidor: todo vive en
# /opt/partner-manager y en contenedores Docker con red y volúmenes propios.
set -euo pipefail

REPO_URL="https://github.com/elvergalarga2222/parthnertplataform.git"
BRANCH="deploy/main-docker"
APP_DIR="/opt/partner-manager"
ENV_FILE="$APP_DIR/deploy/.env"

echo "==> Partner Manager deploy"

# 1. Docker (solo se instala si no existe; no se reconfigura nada)
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker (no estaba presente)…"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 no disponible; instala el plugin docker-compose-plugin" >&2
  exit 1
fi

# 2. Código
if [ -d "$APP_DIR/.git" ]; then
  echo "==> Actualizando código…"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  echo "==> Clonando repositorio…"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# 3. Variables de entorno (se generan una sola vez y se conservan)
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Generando $ENV_FILE (primera vez)…"
  # Elegir el primer puerto libre desde 3000 para no chocar con apps existentes
  APP_PORT=3000
  while ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${APP_PORT}$"; do
    APP_PORT=$((APP_PORT + 1))
  done
  echo "    -> Puerto libre elegido: $APP_PORT"
  cat > "$ENV_FILE" <<EOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AI_KEYS_MASTER_KEY=$(openssl rand -base64 32)
APP_PORT=$APP_PORT
# Acceso de desarrollo mientras no haya API key real de Skool:
AUTH_DEV_EMAILS=
# Completa cuando tengas la API de Skool:
SKOOL_API_KEY=
SKOOL_GROUP_ID=
SKOOL_WEBHOOK_SECRET=
EOF
  chmod 600 "$ENV_FILE"
  echo "    -> Login abierto: cualquier correo entra. Restringe con AUTH_DEV_EMAILS si quieres."
fi

# 4. Build + up
echo "==> Construyendo y levantando contenedores…"
cd "$APP_DIR/deploy"
docker compose --env-file .env up -d --build

# 5. Migraciones (dentro de la red de compose)
echo "==> Aplicando migraciones (crea las 8 tablas del CRM)..."
docker compose --env-file .env run --rm \
  --entrypoint sh app -c "node node_modules/drizzle-kit/bin.cjs migrate"

# Nota: el modulo Clientes crea sus etapas por defecto en el primer acceso, asi
# que aparece funcional sin seed. Los datos demo (npm run db:seed) requieren las
# devDependencies y quedan como paso manual opcional.

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "TU_IP")
PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)
echo ""
echo "✅ Partner Manager desplegado."
echo "   URL:   http://${IP}:${PORT:-3000}"
echo "   Login: cualquier correo (modo abierto). Usa demo@partnermanager.dev si corres el seed."
echo "   Logs:  cd $APP_DIR/deploy && docker compose logs -f app"
