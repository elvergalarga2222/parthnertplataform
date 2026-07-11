#!/usr/bin/env bash
# Smoke test post-deploy: atrapa la clase de fallo "502 / proceso no levantó"
# sin pretender sustituir una prueba manual de login + click-through.
#
# Uso: deploy/smoke.sh <port>
set -euo pipefail

PORT="${1:?Uso: deploy/smoke.sh <port>}"
BASE_URL="http://127.0.0.1:${PORT}"

echo "==> Smoke test contra ${BASE_URL}"

echo "-> GET /api/health"
# Sin -f: queremos poder leer el body (con el detalle postgres/redis) incluso
# si responde 503, para dar un mensaje de fallo claro en vez de un curl: (22).
HEALTH_RESPONSE="$(curl -sS --max-time 10 -w '\n%{http_code}' "${BASE_URL}/api/health")"
HEALTH_CODE="$(echo "$HEALTH_RESPONSE" | tail -n1)"
HEALTH_BODY="$(echo "$HEALTH_RESPONSE" | sed '$d')"
HEALTH_STATUS="$(echo "$HEALTH_BODY" | node -e '
  let data = "";
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => {
    try {
      const json = JSON.parse(data);
      process.stdout.write(String(json.status ?? "unknown"));
    } catch {
      process.stdout.write("parse_error");
    }
  });
')"
if [ "$HEALTH_CODE" != "200" ] || [ "$HEALTH_STATUS" != "ok" ]; then
  echo "FALLO: /api/health respondió HTTP ${HEALTH_CODE}, status=\"${HEALTH_STATUS}\" (esperado 200/\"ok\")" >&2
  echo "$HEALTH_BODY" >&2
  exit 1
fi
echo "   OK (200, status=ok)"

echo "-> GET /login"
LOGIN_CODE="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "${BASE_URL}/login")"
if [ "$LOGIN_CODE" != "200" ]; then
  echo "FALLO: /login respondió HTTP ${LOGIN_CODE} (esperado 200)" >&2
  exit 1
fi
echo "   OK (200)"

echo "==> Smoke test verde."
