# Partner Manager — Plataforma All-in-One para Partners

## Qué es este proyecto

Sistema operativo centralizado para una comunidad exclusiva de estrategas digitales de negocio ("Partners"). Reemplaza Notion, Trello, Miro y Drive consolidando la operación comercial, financiera y operativa en un solo entorno. El acceso está restringido a miembros activos de un grupo de Skool (sin registro manual).

**Documento maestro de arquitectura:** [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — stack, esquema de base de datos completo y plan de ataque por fases. Leerlo antes de tocar cualquier módulo.

## Stack

- **Next.js 15 (App Router) + TypeScript** — frontend y backend en un solo deployable
- **Tailwind CSS + shadcn/ui** — UI
- **PostgreSQL 16 + Drizzle ORM** — base de datos relacional con RLS por Partner; `pgvector` para RAG
- **Redis + BullMQ** — sesiones revocables server-side, jobs (polling Skool, transcripciones, vencimientos)
- **tldraw** (lienzo visual), **Tiptap** (editor de guiones), **dnd-kit** (Kanban)
- **Vercel AI SDK** con BYOK (Anthropic/OpenAI) — el Partner pone su propia API key
- **Cloudflare Stream** (video academia) + **Whisper** (transcripciones)

## Estructura del código

```
src/
  app/           # rutas Next.js (App Router)
  modules/       # lógica de negocio por dominio — los módulos NO se importan entre sí directamente
    auth/        # gating Skool, sesiones Redis, revocación
    crm/         # leads, industrias, pipeline SOBA/NOVA
    workspace/   # clientes, kanban, SOPs, vista pública de cliente
    strategy/    # guiones, copiloto de diagnóstico
    finance/     # ingresos, cuentas por cobrar, regla 70/30, margen
    academy/     # videos, transcripciones, bot "Mi Cabeza"
    canvas/      # lienzo tldraw, plantillas
    ai/          # gateway BYOK, cifrado de keys, cuotas, usage log
  jobs/          # workers BullMQ
  db/            # esquema Drizzle, migraciones, políticas RLS
```

## Reglas de negocio inquebrantables

1. **No hay registro manual.** La identidad viene solo de la API de Skool; la sesión vive en Redis y es revocable al instante (nunca JWT stateless como sesión primaria).
2. **Revocación = congelar, no borrar.** `partners.status = 'frozen'` bloquea todo vía RLS; los datos se conservan.
3. **Aislamiento total por Partner.** Toda tabla tenant lleva `partner_id` + política RLS. Ningún query cruza tenants.
4. **Gates SOBA/NOVA en el pipeline.** Un lead no avanza de etapa sin los campos de Segmento, Oferta (A→B), Vehículo y Atención requeridos por esa transición.
5. **Industrias mainstream obligatorias.** `leads.industry_id` es NOT NULL contra catálogo cerrado; no se permiten micronichos de texto libre.
6. **La plataforma nunca paga tokens de IA.** Resolución de key: BYOK del Partner → créditos prepagados → error 402. Cuota diaria dura en Redis.
7. **Vista de Cliente capada.** La ruta pública por token solo expone `kanban_tasks` con `is_client_visible = true`, read-only.

## Comandos

*(Se actualizarán cuando el scaffolding exista — Fase 0)*

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run lint         # ESLint
npm run test         # tests (Vitest)
npm run db:generate  # generar migraciones Drizzle
npm run db:migrate   # aplicar migraciones
npm run db:seed      # seeds: industrias, SOPs, plantillas de canvas
```

## Convenciones

- **Idioma:** UI y datos de dominio en español; código (variables, funciones, commits) en inglés.
- **PKs:** `uuid` con `gen_random_uuid()`; timestamps `created_at`/`updated_at` en toda tabla.
- **Enums de dominio** como `text` + CHECK (no enums nativos de PG) para facilitar migraciones.
- **Validación:** Zod en el borde (API/forms); reglas de negocio en servicios del módulo, reforzadas con triggers cuando son críticas (gates SOBA, congelamiento).
- **Server Actions** para mutaciones simples; Route Handlers para webhooks y APIs públicas (vista de cliente).

## Roadmap (detalle en docs/ARQUITECTURA.md §6)

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Scaffolding: Next.js, Drizzle, Redis, CI | ⬜ Pendiente |
| 1 | Gating Skool: login, webhook, polling, congelamiento | ⬜ Pendiente |
| 2 | CRM SOBA/NOVA: leads, industrias, pipeline con gates | ⬜ Pendiente |
| 3 | Workspace: kanban, SOPs inyectados, vista de cliente | ⬜ Pendiente |
| 4 | Finanzas: 70/30, cuentas por cobrar, margen | ⬜ Pendiente |
| 5 | IA: gateway BYOK, editor de guiones, copiloto | ⬜ Pendiente |
| 6 | Academia: videos, RAG, bot "Mi Cabeza" | ⬜ Pendiente |
| 7 | Lienzo visual tldraw + plantillas | ⬜ Pendiente |

**Riesgo #1 a validar ya:** capacidades reales de la API de Skool (webhooks, lookup por email). Todo `auth/` se programa contra la interfaz `MembershipProvider` para poder adaptarse.
