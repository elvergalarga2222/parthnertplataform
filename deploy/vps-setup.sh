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
BRANCH="claude/partner-manager-requirements-r11zzp"
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
DEV_MEMBER_EMAILS=demo@partner.com
# Completa cuando tengas la API de Skool:
SKOOL_API_KEY=
SKOOL_GROUP_ID=
SKOOL_WEBHOOK_SECRET=
EOF
  chmod 600 "$ENV_FILE"
  echo "    -> Edita $ENV_FILE para cambiar DEV_MEMBER_EMAILS o el puerto."
fi

# 4. Build + up
echo "==> Construyendo y levantando contenedores…"
cd "$APP_DIR/deploy"
docker compose --env-file .env up -d --build

# 5. Migraciones + seeds (dentro de la red de compose)
echo "==> Aplicando migraciones…"
docker compose --env-file .env run --rm \
  --entrypoint sh app -c "node node_modules/drizzle-kit/bin.cjs migrate"

echo "==> Sembrando catálogos (idempotente)…"
docker compose --env-file .env exec -T db psql -U pm -d partner_manager <<'SQL'
INSERT INTO industries (name) VALUES
  ('Médicos y clínicas'),('Odontología'),('Estéticas y belleza'),
  ('Fitness y gimnasios'),('Restaurantes y gastronomía'),('Inmobiliario'),
  ('Construcción y remodelación'),('Industrial y manufactura'),
  ('Logística y transporte'),('Educación y academias'),('Legal y contable'),
  ('Tecnología y software'),('Retail y e-commerce'),('Turismo y hotelería'),
  ('Automotriz'),('Agencias de marketing'),('Seguros y finanzas'),
  ('Veterinarias y mascotas')
ON CONFLICT (name) DO NOTHING;

INSERT INTO sop_templates (title, kind, phase, sort_order, body) VALUES
  ('SOP 1 — Diagnóstico inicial del negocio', 'sop', 'diagnostico', 10,
   E'1. Agenda la sesión de diagnóstico (60–90 min) con el dueño.\n2. Levanta: facturación mensual, margen, fuentes de clientes actuales, capacidad instalada.\n3. Identifica el cuello de botella principal (captación, conversión o entrega).\n4. Documenta el Punto A del cliente con números, no con opiniones.\n5. Valida con el cliente el Punto B deseado a 90 días.'),
  ('Prompt IA — Preparar diagnóstico', 'ai_prompt', 'diagnostico', 20,
   'Actúa como consultor de negocios. Con estos datos del cliente [pegar datos del diagnóstico], identifica: (1) el cuello de botella principal de rentabilidad, (2) tres palancas de mejora ordenadas por impacto/esfuerzo, (3) los riesgos de cada una. Formato: tabla + resumen ejecutivo de 5 líneas.'),
  ('SOP 2 — Kickoff y plan de implementación', 'sop', 'implementacion', 30,
   E'1. Presenta el plan de 90 días dividido en sprints quincenales.\n2. Carga las tareas del sprint 1 en el kanban y marca cuáles verá el cliente.\n3. Comparte la Vista de Cliente para que audite el progreso.\n4. Define el canal y la cadencia de reporte (semanal recomendado).'),
  ('SOP 3 — Reporte quincenal de avance', 'sop', 'implementacion', 40,
   E'1. Revisa el kanban: mueve tareas estancadas y documenta el porqué.\n2. Actualiza métricas del cliente vs. Punto B.\n3. Envía resumen: hecho, en curso, bloqueado, siguiente.\n4. Agenda la siguiente revisión antes de cerrar la llamada.'),
  ('Prompt IA — Guion de presentación de resultados', 'ai_prompt', 'entrega', 50,
   'Con estos avances [pegar lista de tareas finalizadas y métricas], redacta un guion de 10 minutos para presentar resultados al cliente: gancho inicial con el logro más tangible, narrativa Punto A → Punto B, y cierre con próximos pasos que refuercen la continuidad del servicio.')
ON CONFLICT (title) DO NOTHING;
SQL

IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "TU_IP")
PORT=$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)
echo ""
echo "✅ Partner Manager desplegado."
echo "   URL:   http://${IP}:${PORT:-3000}"
echo "   Login: el email configurado en DEV_MEMBER_EMAILS de $ENV_FILE"
echo "   Logs:  cd $APP_DIR/deploy && docker compose logs -f app"
