# Staging en el VPS (PM2, sin Docker)

Motivación: el 502 en producción tras la cadena de merges de PR-14/PR-15/PR-10 — a partir de ahora los PRs se prueban en `staging.arenacatticos.store` antes de tocar producción. Producción corre en un único VPS bajo **PM2, sin Docker** en el flujo real (el tooling Docker de `deploy/` — ver [`deploy/README.md`](../deploy/README.md) — no es lo que sirve `arenacatticos.store`).

> **Este runbook asume** (§0 de la spec de PR-16, sin confirmar todavía — ajusta lo que no cuadre con tu VPS real antes de seguirlo la primera vez):
> 1. Postgres y Redis corren **nativos** (`apt`), no en contenedores sueltos.
> 2. Nginx + certbot ya gestionan `arenacatticos.store` y se reutilizan para el subdominio de staging.
> 3. Este PR **adopta también producción** dentro de `ecosystem.config.js` (los procesos `pm-web`/`pm-jobs` ya definidos) — si producción hoy corre distinto (otro nombre de proceso PM2, otra ruta), auditar con `pm2 describe` **antes** de correr `deploy-prod.sh` la primera vez y ajustar `ecosystem.config.js` en consecuencia.
>
> Si la RAM del VPS va justa, staging no necesita estar levantado permanentemente: `pm2 stop pm-web-staging pm-jobs-staging` cuando no se está probando nada, y `deploy-staging.sh` lo vuelve a levantar (hace `pm2 start`/`restart` según corresponda) la próxima vez.

## Diseño (resumen)

| Recurso | Producción | Staging |
|---|---|---|
| Código | `/opt/partner-manager` (tag desplegado) | `/opt/partner-manager-staging` (rama `main`) |
| Proceso PM2 | `pm-web` (+ `pm-jobs`) | `pm-web-staging` (+ `pm-jobs-staging`) |
| Puerto | 3000 | 3100, **solo loopback** (nginx hace el proxy) |
| Postgres | BD `partner_manager` | BD **distinta** `partner_manager_staging`, usuario propio `pm_staging` |
| Redis | `redis://localhost:6379/0` | `redis://localhost:6379/1` (DB lógica distinta) |
| Dominio | `arenacatticos.store` | `staging.arenacatticos.store` + Basic Auth |
| Datos | reales | solo seed (`db:seed`); **nunca** copiar dumps de producción |

Flujo de ramas: los PRs mergean a `main` como hasta ahora → staging deploya `main` HEAD → smoke test + prueba manual → si está verde, `git tag vX.Y` → producción deploya **ese tag**. El rollback es desplegar el tag anterior — un rollback es solo otro deploy.

## Runbook de una sola vez (a mano, en el VPS)

### 1. Base de datos y usuario de staging

```sql
CREATE USER pm_staging WITH PASSWORD '<contraseña fuerte, generar con openssl rand -hex 24>';
CREATE DATABASE partner_manager_staging OWNER pm_staging;
```

### 2. `.env` de staging

Crear `/opt/partner-manager-staging/.env` (después del primer `git clone` que hace `deploy-staging.sh`, o antes a mano):

```bash
# --- Postgres (BD SEPARADA de producción) ---
DATABASE_URL=postgres://pm_staging:<password>@localhost:5432/partner_manager_staging

# --- Redis (DB lógica 1, separada de producción que usa la 0) ---
REDIS_URL=redis://localhost:6379/1

# --- Server Actions: crítico, sin esto TODAS las mutaciones fallan en staging ---
ALLOWED_ORIGINS=staging.arenacatticos.store

# --- Login sin Skool real: tus correos de prueba ---
AUTH_DEV_EMAILS=tu-correo@ejemplo.com

# --- Operador del panel admin en staging (independiente de producción) ---
ADMIN_EMAILS=tu-correo@ejemplo.com

# --- Skool: vacío a propósito, staging no habla con el grupo real ---
SKOOL_API_KEY=
SKOOL_GROUP_ID=
SKOOL_WEBHOOK_SECRET=

# --- IA: mock, sin key real ni gasto ---
AI_PROVIDER=mock
# Cifrado BYOK — clave PROPIA de staging, nunca la de producción:
AI_KEYS_MASTER_KEY=<generar con: openssl rand -base64 32>

# --- Visor de logs (PR-14) ---
LOG_BUFFER_MAX=500

NODE_ENV=production
```

`chmod 600 .env` — nunca commitear este archivo (ya está en `.gitignore` como `.env`).

### 3. Nginx

```nginx
server {
    listen 443 ssl;
    server_name staging.arenacatticos.store;

    auth_basic "Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;

    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

Generar el usuario/contraseña de Basic Auth: `sudo htpasswd -c /etc/nginx/.htpasswd-staging <usuario>`.

### 4. DNS + certbot

1. Crear el registro DNS `A` para `staging.arenacatticos.store` apuntando a la IP del VPS.
2. `sudo certbot --nginx -d staging.arenacatticos.store`.

### 5. Primer deploy

```bash
sudo apt install -y nodejs npm  # si node/npm no están ya (el repo usa node 22)
sudo npm install -g pm2
git clone https://github.com/elvergalarga2222/parthnertplataform.git /opt/partner-manager-staging
cd /opt/partner-manager-staging
# crear .env como en el paso 2
bash deploy/deploy-staging.sh
```

## Operación

**Ciclo normal:** merge a `main` → `bash /opt/partner-manager-staging/deploy/deploy-staging.sh` → probar manualmente en `https://staging.arenacatticos.store` (login con `AUTH_DEV_EMAILS`, click-through del PR en cuestión) → si está verde:

```bash
git tag v0.5   # en tu checkout local, sobre el commit ya probado en staging (main HEAD)
git push origin v0.5
```

luego, en el VPS:

```bash
bash /opt/partner-manager/deploy/deploy-prod.sh v0.5
```

**Rollback:** `bash /opt/partner-manager/deploy/deploy-prod.sh <tag-anterior>`.

**Pausar staging (RAM ajustada):** `pm2 stop pm-web-staging pm-jobs-staging`. Retomar: correr `deploy-staging.sh` de nuevo (o `pm2 start pm-web-staging pm-jobs-staging` si el código no cambió).

**Verificar aislamiento de sesiones/Redis** (manual, una vez): loguearse en staging y correr `redis-cli -n 0 KEYS "session:*"` — no debe aparecer ninguna sesión nueva ahí (deben estar en `redis-cli -n 1 KEYS "session:*"`).

**Logs:** `pm2 logs pm-web-staging` / `pm2 logs pm-jobs-staging`.
