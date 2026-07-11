# deploy/ — qué flujo está vigente

**Vigente en producción:** `deploy-staging.sh`, `deploy-prod.sh`, `smoke.sh` + `ecosystem.config.js` (raíz del repo), PM2 sin Docker. Ver [`docs/STAGING.md`](../docs/STAGING.md).

**NO vigente / no usado en producción:** `docker-compose.yml` y `vps-setup.sh` de este directorio. Se conservan como alternativa Docker (útil para levantar el stack local o en otro entorno), pero `arenacatticos.store` no corre sobre ellos — no asumas que sí (incluido Claude Code futuro).
