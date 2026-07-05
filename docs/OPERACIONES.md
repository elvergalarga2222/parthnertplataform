# Operaciones y diagnóstico

Guía rápida para operar y depurar Partner Manager en el VPS (Next.js standalone
+ PM2 + Postgres + Redis, detrás de Nginx con HTTPS).

## Healthcheck: diagnóstico con un solo curl

```bash
curl -s https://<dominio>/api/health | jq
```

Devuelve `200` si Postgres **y** Redis responden, `503` si alguno falla:

```json
{
  "status": "ok",
  "time": "2026-07-05T12:00:00.000Z",
  "uptimeSeconds": 3600,
  "env": "production",
  "version": "abc1234",
  "checks": {
    "postgres": { "ok": true, "latencyMs": 3 },
    "redis":    { "ok": true, "latencyMs": 1 }
  }
}
```

Si algo está caído, el campo `error` de ese check dice exactamente qué pasó —
sin tener que entrar por SSH a revisar servicios uno por uno.

## Logs estructurados (grep en pm2)

Todo log del servidor sale como una línea JSON. Búsquedas útiles:

```bash
pm2 logs partner-manager | grep '"level":"error"'      # solo errores
pm2 logs partner-manager | grep '"partnerId":"<id>"'    # actividad de un partner
pm2 logs partner-manager | grep '"requestId":"<id>"'    # una petición completa
pm2 logs partner-manager | grep '"source":"client"'     # errores del navegador
```

Los errores que ocurren en el navegador (error boundaries de React) se envían a
`/api/log` y quedan registrados en el servidor con `"source":"client"`, así que
ya **no** dependen de que alguien tenga la consola del navegador abierta en el
momento exacto del fallo.

Nivel de log configurable con `LOG_LEVEL` (`debug|info|warn|error`).

## Pantallas de error (nunca más un `<main>` en blanco)

- `app/global-error.tsx` — red de seguridad si falla el layout raíz (el caso del
  pantallazo en blanco). Trae estilos inline por si la hoja de estilos no cargó.
- `app/error.tsx` — errores fuera del área autenticada (p. ej. `/login`).
- `app/(app)/error.tsx` — errores de cualquier módulo autenticado; el sidebar se
  mantiene y el `digest` mostrado permite localizar el stack en los logs.
- `app/not-found.tsx` — 404 con estilo del dashboard.

Todas reportan al servidor automáticamente.

## Cambio de dominio (Nginx + HTTPS)

Al servir por un dominio distinto al host interno, hay que declarar los dominios
en `ALLOWED_ORIGINS` (ver `.env.example`) **o** las Server Actions se rechazan.

Nginx debe pasar las cabeceras de host/protocolo correctamente:

```nginx
server {
    server_name deno.arenacatticos.store;

    location / {
        proxy_pass http://127.0.0.1:3011;   # puerto del proceso PM2
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # https
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
    # HTTPS gestionado por Certbot / Let's Encrypt
}
```

Con `X-Forwarded-Proto: https` correcto, la cookie de sesión (`secure` en
producción) viaja bien. **Nota:** servir la app por HTTP plano en producción
rompe el login porque la cookie es `secure`; el paso a HTTPS lo soluciona.

> Este documento no modifica `deploy.yml` ni el arranque de PM2. La config de
> Nginx y las variables de entorno se aplican manualmente en el servidor.
