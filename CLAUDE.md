# Partner Manager — Plataforma All-in-One para Partners

## Qué es este proyecto

Sistema operativo centralizado para una comunidad exclusiva de estrategas digitales de negocio ("Partners"). Reemplaza Notion, Trello, Miro y Drive consolidando la operación comercial, financiera y operativa en un solo entorno. El acceso está restringido a miembros activos de un grupo de Skool (sin registro manual).

**Documentos maestros** (leer antes de tocar un módulo):
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — stack, esquema de BD completo y plan de ataque por fases.
- [`docs/OPERACIONES.md`](docs/OPERACIONES.md) — operación en producción.
- [`docs/STAGING.md`](docs/STAGING.md) — entorno de staging sobre PM2 (PR-16, sin Docker).

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** — frontend y backend en un solo deployable
- **Tailwind CSS v4** — UI (componentes propios en `src/components/`; no hay dependencia de shadcn instalada aún)
- **PostgreSQL 16 + Drizzle ORM** (`postgres` como driver) — base de datos relacional con aislamiento por `partner_id`; `pgvector` planeado para RAG (Fase 6)
- **Redis + BullMQ** (`ioredis`) — sesiones revocables server-side y jobs (polling Skool, vencimientos)
- **Anthropic SDK (`@anthropic-ai/sdk`)** con BYOK — el Partner pone su propia API key (AES-256-GCM); provider mock para tests/dev
- **dnd-kit** — Kanban (CRM pipeline y workspace)
- **Zod v4** — validación en el borde
- **Vitest** — tests unitarios e integración
- **Pendiente / futuro:** tldraw (lienzo), Tiptap (editor de guiones), Cloudflare Stream + Whisper (academia)

## Estructura del código

```
src/
  app/
    (app)/         # área autenticada del Partner: dashboard, clientes, espacios, flujos,
                   #   partner-business, equipo, academia
    (admin)/       # panel de operador: partners (freeze/unfreeze), logs, feedback
    invitacion/    # alta de colaborador por token (PR-8, sin Skool)
    login/         # gating Skool + bypass ADMIN_EMAILS
    api/           # health, log (errores de cliente), webhooks/invoices (n8n)
  components/      # UI por dominio (clientes, workspace, partner-business, equipo, dashboard, admin…)
  modules/         # lógica de negocio por dominio — los módulos NO se importan entre sí directamente
    auth/          # gating Skool, sesiones Redis, revocación, actor (partner/colaborador), admin
    crm/           # empresas, contactos, pipeline configurable, deals, campos custom
    workspace/     # workspaces por cliente ganado, kanban, SOPs, perfil, doc de estrategia
    finance/       # invoices, expenses, budget, 70/30, margen, snapshot mensual
    ai/            # gateway BYOK, cifrado de keys, cuotas, prompts, historial de generaciones
    team/          # colaboradores por partner + reuniones (PR-8)
    admin/         # servicios del panel de operador + visor de logs
    feedback/      # reportes de bugs/sugerencias de testers (PR-15)
    dashboard/     # agregación de KPIs (CRM + workspace + finance)
  jobs/            # workers BullMQ (membership-sync cada 6 h)
  lib/             # utilidades transversales (dates, format, logger, redis, markdown-lite)
  db/              # esquema Drizzle (schema/*.ts), migraciones (0000–0013), seed, triggers/vistas
```

## Reglas de negocio inquebrantables

1. **No hay registro manual.** La identidad viene solo de la API de Skool; la sesión vive en Redis y es revocable al instante (nunca JWT stateless como sesión primaria). **Excepción (PR-8):** los *colaboradores* (equipo de un Partner) se invitan por email sin pasar por Skool. No son Partners — son invitados subordinados a la cuenta de un Partner, nunca tenants propios — y su acceso vive y muere con el Partner que los invitó: congelar al Partner corta también a sus colaboradores al instante (mismo mecanismo de sesión revocable, ver `auth/session.ts` y `auth/service.ts#getCurrentActor`). **Excepción (ADMIN_EMAILS):** los operadores en `ADMIN_EMAILS` entran sin membresía Skool activa (bypass, ver `auth/service.ts`).
2. **Revocación = congelar, no borrar.** `partners.status = 'frozen'` bloquea todo el acceso; los datos se conservan.
3. **Aislamiento total por Partner.** Toda tabla tenant lleva `partner_id`; ningún query cruza tenants. El scoping se refuerza en los servicios de cada módulo (`getCurrentPartner()` / `getCurrentActor()`).
4. **Pipeline configurable por Partner.** Las etapas se crean, renombran, reordenan y eliminan desde la UI sin tocar código. Los gates SOBA/NOVA dejaron de ser bloqueo duro; volvió una versión mínima: una etapa puede exigir brief para entrar (`pipeline_stages.requires_brief`, PR-12).
5. **Campos personalizados sin migraciones.** `custom_fields` + `custom_field_values` (EAV) permiten al Partner añadir columnas desde la UI. El catálogo cerrado de industrias queda diferido.
6. **La plataforma nunca paga tokens de IA.** Resolución de key: BYOK del Partner → créditos prepagados → error 402. Límite mensual por partner (`ai_usage_limits`). La key se guarda cifrada AES-256-GCM (`ai/crypto.ts`), nunca en texto plano.
7. **Vista de Cliente capada.** La ruta pública por token solo expone `kanban_cards` con `is_client_visible = true`, read-only. Nada más (ni feedback, ni finanzas) se expone por token.

## Modelo de identidad (Actor)

`getCurrentActor()` devuelve el **Actor** de la petición: el `partner` (el tenant, siempre) y opcionalmente el `collaborator` que actúa en su nombre (`permission: "editor" | "lector"`). Devuelve `null` si no hay sesión, el partner está congelado, o el colaborador fue desactivado. `getCurrentPartner()` se mantiene sobre `getCurrentActor()` para que las lecturas de crm/workspace/finance/ai sigan scoped por `partner.id` sin importar quién actúe. Las mutaciones que deben excluir a `lector` usan `requireEditor()`.

## Base de datos

Esquema en `src/db/schema/*.ts`; migraciones 0000–0013 en `src/db/migrations/`. Tablas por dominio:

- **partners** (`partners.ts`): `partners`, `skool_memberships` (ciclo de renovación + alertas, PR-10), `access_audit_log`.
- **crm** (`crm.ts`): `companies`, `contacts`, `pipeline_stages`, `deals`, `deal_activity`, `custom_fields`, `custom_field_values`, `lists` (segmentos guardados; tabla lista, CRUD UI pendiente).
- **workspace** (`workspace.ts`): `workspaces` (auto-creados por trigger cuando un deal entra a etapa `is_won`), `workspace_profiles` (perfil + doc de estrategia), `kanban_columns` (con SOP), `kanban_cards` (`is_client_visible`).
- **finance** (`finance.ts`): `budget_projections` (meta de profit mensual), `invoices` (cuentas por cobrar, `external_ref` idempotente para n8n, tipo de ingreso para 70/30), `expenses`. Multi-moneda por registro (COP/USD/EUR), **sin conversión automática** — las vistas agregan por moneda.
- **ai** (`ai.ts`): `ai_prompts` (globales o por partner), `ai_generations` (auditoría + costo que consume `v_monthly_profit`), `ai_usage_limits`, `ai_partner_keys` (BYOK cifrada).
- **team** (`team.ts`): `collaborators`, `meetings`, `meeting_attendees` (PR-8).
- **feedback** (`feedback.ts`): `feedback_reports` (solo visibles por el partner que los creó y el operador).

Vistas SQL de finanzas (migración `0006_finance_views`): `v_monthly_revenue`, `v_monthly_profit` (incluye costo de IA).

## IA / providers

`AI_PROVIDER` selecciona el provider (`anthropic` real o `mock` para tests/dev), `AI_MODEL` el modelo. La key BYOK del partner se resuelve en runtime; si no hay, cae a créditos y luego 402. Todo el consumo se registra en `ai_generations` para auditoría y para el cálculo de margen en Partner Business.

## Autenticación / providers de membresía

`getMembershipProvider()` (`auth/providers/index.ts`) resuelve en orden:
1. **Skool real** si `SKOOL_API_KEY` + `SKOOL_GROUP_ID` están configuradas.
2. **DevMembershipProvider** (lista fija) si `AUTH_DEV_EMAILS` está definida.
3. **OpenMembershipProvider** (cualquier email válido entra) — modo por defecto mientras Skool no esté integrado (**riesgo #1**).

Todo `auth/` se programa contra la interfaz `MembershipProvider` para poder adaptarse a las capacidades reales de la API de Skool.

## Jobs (BullMQ)

`npm run jobs` levanta los workers. Actualmente: **membership-sync** (`jobs/membership-sync.worker.ts`), job repetible cada 6 h que sincroniza membresías de Skool, aplica alertas de renovación y congela/descongela automáticamente (PR-10, con fail-safe: solo actúa tras 3 ejecuciones consecutivas sin ver al partner).

## Variables de entorno

`DATABASE_URL`, `REDIS_URL`, `ADMIN_EMAILS`, `AUTH_DEV_EMAILS`, `SKOOL_API_KEY`, `SKOOL_GROUP_ID`, `SKOOL_GROUP_URL`, `MEMBERSHIP_GRACE_DAYS`, `AI_PROVIDER`, `AI_MODEL`, `AI_KEYS_MASTER_KEY`, `FINANCE_WEBHOOK_SECRET`, `SEED_PARTNER_EMAIL`, `LOG_LEVEL`, `LOG_BUFFER_MAX`, `APP_VERSION`, `NODE_ENV`.

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run start        # servidor de producción
npm run lint         # ESLint
npm run test         # tests (Vitest: *.test.ts unit, *.integration.test.ts integración)
npm run jobs         # levanta workers BullMQ (membership-sync cada 6 h)
npm run db:generate  # generar migraciones Drizzle
npm run db:migrate   # aplicar migraciones
npm run db:seed      # seed demo del CRM (partner demo, etapas, deals); idempotente
```

## Convenciones

- **Idioma:** UI y datos de dominio en español; código (variables, funciones, commits) en inglés.
- **PKs:** `uuid` con `gen_random_uuid()`; timestamps `created_at`/`updated_at` en toda tabla.
- **Enums de dominio** como `text` + CHECK (no enums nativos de PG) para facilitar migraciones.
- **Validación:** Zod en el borde (API/forms); reglas de negocio en servicios del módulo, reforzadas con triggers cuando son críticas (auto-creación de workspace, congelamiento).
- **Server Actions** para mutaciones (cada módulo expone `actions.ts`); Route Handlers para webhooks y APIs públicas (`app/api/`).
- **Aislamiento de módulos:** un módulo NO importa a otro directamente. El cruce ocurre vía BD (tablas con `partner_id`) o vía `dashboard/` que agrega lecturas.

## Roadmap y estado actual

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Scaffolding: Next.js, Drizzle, Redis, CI | ✅ Hecho |
| 1 | Gating Skool: login, congelamiento, polling, alertas de renovación | 🟨 Login + congelamiento (manual vía panel admin y automático por vencimiento) + polling cada 6 h listos. **Falta:** webhook entrante de Skool y login-hardening |
| 2 | CRM: empresas/contactos/deals, pipeline configurable, campos custom, gate de brief | 🟨 Pipeline kanban, deals, campos custom y gate de brief (PR-12) listos. **Falta:** inbox, listas guardadas (tabla lista), automatizaciones |
| 3 | Workspace: kanban, SOPs, perfil, doc de estrategia exportable | 🟨 Kanban, SOPs, perfil y export a PDF (PR-13) listos. **Falta:** vista pública de cliente por token |
| 4 | Finanzas: 70/30, cuentas por cobrar, margen, calendario de cobros | 🟨 PR-4a (modelo multi-moneda, vistas revenue/profit, webhook n8n, KPIs+alertas) y PR-4b (UI: invoices, expenses, budget, calendario, 70/30, meta mensual) listos |
| 5 | IA: gateway BYOK, guiones, copiloto de diagnóstico | 🟨 BYOK + cuotas + generación de guiones/estrategia/diagnóstico embebidos en el workspace. **Falta:** editor de guiones dedicado e imágenes |
| 6 | Academia: videos, RAG, bot "Mi Cabeza" | ⬜ Pendiente (ruta `/academia` es placeholder) |
| 7 | Lienzo visual tldraw + plantillas | ⬜ Pendiente |
| — | **Transversal (hecho):** panel de operador freeze/unfreeze (PR-7), visor de logs (PR-14), feedback de testers (PR-15), colaboradores/equipo (PR-8), tooling de staging PM2 (PR-16) | ✅ Hecho |

**Riesgo #1 a validar ya:** capacidades reales de la API de Skool (webhooks, lookup por email). Por eso `auth/` está desacoplado tras `MembershipProvider` y el modo por defecto es `OpenMembershipProvider`.
