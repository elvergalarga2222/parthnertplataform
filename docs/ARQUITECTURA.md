# Propuesta Arquitectónica — Partner Manager

> Plataforma all-in-one para la comunidad de Partners (estrategas digitales de negocio).
> Versión 0.1 — borrador para revisión y refutación.

---

## 1. Principios de diseño

1. **Multi-tenant por Partner, single-tenant por percepción.** Cada Partner opera en un entorno lógicamente aislado (Row-Level Security por `partner_id`), pero la infraestructura es compartida para mantener costos bajos.
2. **Skool es la única fuente de verdad de identidad.** No existe tabla de contraseñas. La sesión local es un *espejo revocable* del estado de membresía en Skool.
3. **BYOK (Bring Your Own Key) para IA.** La plataforma nunca asume el costo de tokens; cada Partner registra su propia API key (cifrada) o consume un pool de créditos prepagados.
4. **Congelar, no borrar.** La revocación de acceso congela datos (soft-freeze), nunca los destruye — un Partner que renueva su membresía recupera todo.
5. **Monolito modular primero.** Un solo deployable (Next.js full-stack) con módulos internos bien delimitados. Microservicios solo cuando el dolor lo justifique.

---

## 2. Stack tecnológico

| Capa | Elección | Justificación |
|---|---|---|
| Frontend + Backend | **Next.js 15 (App Router) + TypeScript** | Un solo repo/deploy, RSC para dashboards pesados de datos, API Routes para webhooks de Skool. |
| UI | **Tailwind CSS + shadcn/ui** | Velocidad de construcción; componentes de Kanban, tablas y formularios listos para adaptar. |
| Base de datos | **PostgreSQL 16** (Supabase o RDS) | Relacional (los requerimientos son intensamente relacionales), RLS nativo para aislamiento por Partner, `pgvector` para el bot RAG. |
| ORM | **Drizzle ORM** | Migraciones SQL-first, tipado estricto, sin la caja negra de Prisma en queries complejos (reportes financieros). |
| Sesiones / caché / colas | **Redis + BullMQ** | Sesiones revocables server-side (requisito de revocación inmediata), jobs de polling a Skool, ingestión de transcripciones. |
| Kanban / drag & drop | **dnd-kit** | Nativo, sin dependencia SaaS. |
| Lienzo visual (Épica 7) | **tldraw SDK** | Canvas tipo Miro embebible, open-source, con serialización JSON propia → se persiste en Postgres. |
| Editor de guiones | **Tiptap** (ProseMirror) | Editor rico extensible, JSON serializable, base para sugerencias de IA inline. |
| IA (copiloto, bot) | **Anthropic Claude / OpenAI vía BYOK** + Vercel AI SDK | Abstracción de proveedor; el Partner elige. Modelo por defecto: `claude-sonnet-5` (mejor costo/calidad para diagnóstico). |
| Embeddings / RAG | **pgvector** + `text-embedding-3-small` (u open-source) | Evita un vector-DB adicional; las transcripciones viven junto a sus metadatos de video. |
| Video (Épica 6) | **Cloudflare Stream** (o Mux) | Hosting + HLS + timestamps deep-link (`?t=1234`) sin construir infraestructura de video. |
| Transcripción | **Whisper (API o self-host)** en job de BullMQ | Genera transcripción + timestamps por segmento para el bot "Mi Cabeza". |
| Cifrado de API keys | **AES-256-GCM** con llave maestra en KMS/secret del entorno | Las keys BYOK jamás se almacenan en claro ni viajan al cliente. |
| Hosting | **Vercel** (app) + **Supabase** (DB/storage) + **Upstash/Redis Cloud** | Cero ops al inicio; portable a contenedores si escala. |
| Observabilidad | Sentry + Axiom/Logtail | Errores + auditoría de accesos (crítico para el gating). |

---

## 3. Autenticación y gating por Skool (Épica 1)

### Flujo de acceso
1. El usuario llega a `/login` e inicia el flujo de verificación (email de Skool → magic link, o OAuth si la API de Skool lo expone).
2. El backend llama a la **Skool API** (`GET /groups/{group_id}/members?email=...`) y valida: existe, `status = active`, pertenece al grupo configurado.
3. Si es válido: se hace *upsert* de `partners` + `skool_memberships` y se crea una **sesión server-side en Redis** (`sess:{id}` → `partner_id`, TTL 24 h) con cookie httpOnly.
4. Si no: acceso denegado con mensaje de "membresía requerida".

### Revocación inmediata
- **Webhook** (canal primario): endpoint `/api/webhooks/skool` recibe eventos `member.removed` / `member.churned` → borra todas las claves `sess:*` del Partner en Redis, marca `partners.status = 'frozen'`.
- **Polling** (red de seguridad): job de BullMQ cada 15 min recorre membresías activas contra la API de Skool y reconcilia. Cubre webhooks perdidos.
- **Verificación perezosa**: en cada request, el middleware valida la sesión contra Redis (O(1)); si la sesión no existe → 401 instantáneo. La revocación es efectiva en el siguiente request, sin esperar expiración de JWT (por eso **no** usamos JWT stateless como sesión primaria).

### Congelamiento de datos
`partners.status ∈ {active, frozen}`. RLS bloquea todo acceso de lectura/escritura cuando `frozen`, pero nada se borra. Al reactivar membresía, el estado vuelve a `active` y todo reaparece.

---

## 4. Esquema de base de datos relacional

Convenciones: PK `id uuid default gen_random_uuid()`, timestamps `created_at/updated_at` en todas las tablas, RLS activo con política `partner_id = current_partner()` en toda tabla tenant.

### 4.1 Identidad y gating

```sql
partners (
  id uuid PK,
  skool_member_id text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active',      -- active | frozen
  frozen_at timestamptz,
  created_at, updated_at
)

skool_memberships (
  id uuid PK,
  partner_id uuid FK -> partners,
  group_id text NOT NULL,                     -- grupo de Skool requerido
  membership_status text NOT NULL,            -- active | churned | removed
  last_verified_at timestamptz NOT NULL,      -- última reconciliación (polling)
  raw_payload jsonb                           -- respuesta cruda de la API para auditoría
)

access_audit_log (
  id bigserial PK,
  partner_id uuid,
  event text NOT NULL,        -- login | denied | revoked_webhook | revoked_polling | frozen | reactivated
  detail jsonb,
  created_at timestamptz
)
```

### 4.2 Módulo comercial SOBA/NOVA (Épica 2)

```sql
industries (               -- catálogo cerrado "mainstream", gestionado por admin
  id serial PK,
  name text UNIQUE NOT NULL,        -- Médicos, Estéticas, Industrial, ...
  is_active boolean DEFAULT true
)

leads (
  id uuid PK,
  partner_id uuid FK -> partners,           -- aislamiento total
  industry_id int FK -> industries NOT NULL, -- obligatorio: filtro mainstream
  business_name text NOT NULL,
  contact_name text, contact_email text, contact_phone text,
  stage text NOT NULL DEFAULT 'prospecto',  -- prospecto | calificado | propuesta | negociacion | cerrado_ganado | cerrado_perdido
  -- Campos SOBA/NOVA (gates de avance de etapa):
  soba_segment text,          -- Segmento: a quién le vende
  soba_offer_point_a text,    -- Oferta: punto A (situación actual)
  soba_offer_point_b text,    -- Oferta: punto B (transformación)
  soba_vehicle text,          -- consultoria | asesoria_mensual
  soba_attention text,        -- estrategia de atracción por marca personal
  estimated_value numeric(12,2),
  closed_at timestamptz,
  notes text
)

lead_stage_history (
  id bigserial PK,
  lead_id uuid FK -> leads,
  from_stage text, to_stage text,
  changed_at timestamptz
)
```

**Regla de negocio (capa de servicio + CHECK diferido):** un lead no puede pasar de `calificado` a `propuesta` sin `soba_segment`, `soba_offer_*` y `soba_vehicle` completos; no puede pasar a `negociacion` sin `soba_attention`. Se valida en el servicio y se refuerza con un trigger.

### 4.3 Workspace de operación (Épica 3)

```sql
clients (                    -- lead cerrado_ganado promovido a cliente
  id uuid PK,
  partner_id uuid FK,
  lead_id uuid FK -> leads UNIQUE,   -- trazabilidad comercial
  name text NOT NULL,
  status text DEFAULT 'active'
)

workspaces (
  id uuid PK,
  partner_id uuid FK,
  client_id uuid FK -> clients UNIQUE,   -- un workspace por cliente
  name text NOT NULL,
  client_view_token text UNIQUE,          -- token de la "Vista de Cliente" pública
  client_view_enabled boolean DEFAULT false
)

kanban_tasks (
  id uuid PK,
  workspace_id uuid FK -> workspaces,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'por_hacer',  -- por_hacer | en_proceso | en_estancamiento | finalizado
  position numeric NOT NULL,                  -- orden fraccional dentro de columna
  is_client_visible boolean DEFAULT true,     -- capado: el Partner decide qué audita el cliente
  due_date date,
  stalled_since timestamptz                   -- auto-set al entrar a en_estancamiento
)

sop_templates (              -- catálogo global (admin) de SOPs y prompts
  id uuid PK,
  title text NOT NULL,
  kind text NOT NULL,        -- sop | ai_prompt
  phase text,                -- diagnostico | implementacion | optimizacion | entrega
  body jsonb NOT NULL,       -- contenido rico (Tiptap JSON)
  sort_order int,
  is_active boolean DEFAULT true
)

workspace_sops (             -- instancia inyectada al crear el workspace
  id uuid PK,
  workspace_id uuid FK,
  template_id uuid FK -> sop_templates,
  body jsonb NOT NULL,       -- copia editable por el Partner
  completed_at timestamptz
)
```

**Vista de Cliente:** ruta pública `/client-view/{token}` (sin login) que solo lee `kanban_tasks WHERE is_client_visible = true`, renderizada read-only. Token rotable por el Partner.

### 4.4 Estrategia e IA (Épica 4)

```sql
scripts (                    -- editor de guiones
  id uuid PK,
  partner_id uuid FK,
  client_id uuid FK NULL,    -- guion puede o no estar atado a un cliente
  title text NOT NULL,
  content jsonb NOT NULL,    -- Tiptap JSON
  status text DEFAULT 'borrador'
)

ai_provider_keys (
  id uuid PK,
  partner_id uuid FK UNIQUE (partner_id, provider),
  provider text NOT NULL,           -- anthropic | openai
  encrypted_key bytea NOT NULL,     -- AES-256-GCM
  key_last4 text NOT NULL,          -- para mostrar "sk-...abcd"
  is_valid boolean DEFAULT true     -- marcada false si el proveedor devuelve 401
)

ai_usage_log (
  id bigserial PK,
  partner_id uuid FK,
  feature text NOT NULL,            -- copiloto_diagnostico | bot_mi_cabeza | editor_guiones
  provider text, model text,
  input_tokens int, output_tokens int,
  cost_estimate numeric(10,6),
  created_at timestamptz
)

ai_credit_ledger (           -- solo si se habilita modo créditos (alternativa a BYOK)
  id bigserial PK,
  partner_id uuid FK,
  delta int NOT NULL,               -- + compra / - consumo
  reason text, created_at timestamptz
)

diagnostics (                -- copiloto de diagnóstico
  id uuid PK,
  workspace_id uuid FK,
  input_data jsonb NOT NULL,        -- datos recolectados del negocio del cliente
  ai_output jsonb,                  -- sistema de rentabilidad propuesto
  model_used text, created_at timestamptz
)
```

**Política de costos:** todo endpoint de IA resuelve la key así: (1) key BYOK del Partner → úsala; (2) sin key → verificar saldo en `ai_credit_ledger`; (3) sin saldo → 402 con CTA a configurar key. Cuota dura diaria por Partner (rate-limit en Redis) como cinturón de seguridad.

### 4.5 Módulo financiero (Épica 5)

```sql
revenue_entries (
  id uuid PK,
  partner_id uuid FK,
  client_id uuid FK,
  kind text NOT NULL,               -- consultoria | asesoria_mensual  (alimenta la Regla 70/30)
  amount numeric(12,2) NOT NULL,
  currency char(3) DEFAULT 'USD',
  entry_date date NOT NULL
)

receivables (
  id uuid PK,
  partner_id uuid FK,
  client_id uuid FK,
  concept text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'pendiente',  -- pendiente | pagado | vencido
  recurrence text,                  -- null | monthly (cobros recurrentes)
  paid_at timestamptz
)

expenses (
  id uuid PK,
  partner_id uuid FK,
  category text NOT NULL,           -- herramientas | equipo | publicidad | otros
  amount numeric(12,2) NOT NULL,
  entry_date date NOT NULL,
  is_recurring boolean DEFAULT false
)
```

**Cálculos (vistas materializadas o queries agregadas por mes):**
- **Regla 70/30:** `SUM(amount) FILTER (kind='asesoria_mensual') / SUM(amount)` por ventana móvil de 90 días → si > 0.30, la UI muestra alerta roja persistente en el dashboard.
- **Alerta de margen:** `(ingresos - gastos) / ingresos` mensual → semáforo: verde ≥ 0.80, amarillo 0.70–0.80, rojo < 0.70.
- **Vencimientos:** job diario marca `receivables` vencidas y genera notificaciones in-app.

### 4.6 Academia y bot contextual (Épica 6)

```sql
academy_sessions (
  id uuid PK,
  title text NOT NULL,
  description text,
  video_provider_id text NOT NULL,  -- id en Cloudflare Stream
  duration_seconds int,
  published_at timestamptz,
  module text                        -- agrupador temático
)

transcript_chunks (
  id bigserial PK,
  session_id uuid FK -> academy_sessions,
  start_seconds int NOT NULL,       -- para el deep-link con timestamp
  end_seconds int NOT NULL,
  text text NOT NULL,
  embedding vector(1536)            -- pgvector, índice HNSW
)

bot_conversations (
  id uuid PK, partner_id uuid FK, title text
)
bot_messages (
  id bigserial PK,
  conversation_id uuid FK,
  role text, content text,
  citations jsonb,                  -- [{session_id, start_seconds, score}]
  created_at timestamptz
)
```

**Pipeline "Mi Cabeza":** subir video → job Whisper → chunks de ~45 s con solapamiento → embeddings → pgvector. En consulta: retrieve top-8 chunks → Claude responde con citas obligatorias → la UI renderiza "Ver en *Clase X* @ 12:34" con link `?t=754`.

### 4.7 Lienzo visual (Épica 7)

```sql
canvases (
  id uuid PK,
  partner_id uuid FK,
  client_id uuid FK NULL,
  title text NOT NULL,
  document jsonb NOT NULL,          -- snapshot tldraw
  template_id uuid FK NULL -> canvas_templates,
  updated_at timestamptz
)

canvas_templates (                  -- plantillas estratégicas (admin)
  id uuid PK,
  title text NOT NULL,
  category text,                    -- diagnostico | estrategia | venta
  document jsonb NOT NULL,
  thumbnail_url text
)
```

Persistencia por autosave con debounce (5 s) + snapshot versionado ligero (últimas 10 versiones en `canvas_versions`). Colaboración en tiempo real queda fuera del MVP (el Partner trabaja solo en su lienzo).

---

## 5. Arquitectura de módulos (monolito modular)

```
src/
  modules/
    auth/          # Skool gating, sesiones Redis, webhook, polling job
    crm/           # leads, industrias, pipeline SOBA/NOVA
    workspace/     # clients, kanban, SOPs, vista de cliente pública
    strategy/      # editor de guiones, copiloto de diagnóstico
    finance/       # revenue, receivables, expenses, reglas 70/30 y margen
    academy/       # videos, transcripciones, bot Mi Cabeza (RAG)
    canvas/        # tldraw, plantillas
    ai/            # gateway BYOK/créditos, cifrado de keys, usage log, cuotas
  jobs/            # BullMQ: skool-poll, whisper-ingest, receivables-due, digest
  db/              # esquema Drizzle, migraciones, políticas RLS
```

Cada módulo expone servicios internos; los módulos no se importan entre sí salvo vía interfaces (`crm` → `workspace` al promover lead cerrado a cliente).

---

## 6. Plan de ataque (fases)

### Fase 0 — Fundaciones (semana 1)
- Repo Next.js + TypeScript + Tailwind + shadcn, Drizzle + Postgres, Redis, CI.
- Esquema base: `partners`, `skool_memberships`, sesiones, RLS, `access_audit_log`.

### Fase 1 — Gating Skool (semanas 1–2) ← *bloqueante de todo lo demás*
- Login por validación de membresía, sesión Redis, middleware global.
- Webhook de revocación + job de polling + congelamiento de datos.
- **Riesgo a validar de inmediato:** capacidades reales de la API de Skool (¿expone webhooks? ¿lookup de miembro por email?). Si no hay webhooks, el polling baja a 5 min y se documenta la ventana de revocación.

### Fase 2 — CRM SOBA/NOVA (semanas 2–4)
- CRUD de leads con catálogo de industrias obligatorio.
- Pipeline con gates de avance por campos SOBA/NOVA (servicio + trigger).
- Historial de etapas y promoción `cerrado_ganado` → `clients`.

### Fase 3 — Workspace + Kanban + Vista de Cliente (semanas 4–6)
- Workspace por cliente, Kanban dnd-kit con los 4 estados nativos.
- Inyección de SOPs/prompts desde `sop_templates` al crear el workspace.
- Vista pública read-only por token con capado `is_client_visible`.

### Fase 4 — Finanzas (semanas 6–8)
- Ingresos/gastos/cuentas por cobrar, job de vencimientos.
- Dashboard: gráfico 70/30 con alerta, semáforo de margen, flujo de caja.

### Fase 5 — IA: gateway BYOK + copiloto + editor (semanas 8–10)
- Módulo `ai/`: cifrado de keys, resolución BYOK→créditos, usage log, cuotas Redis.
- Editor Tiptap de guiones con acciones de IA inline.
- Copiloto de diagnóstico sobre `diagnostics`.

### Fase 6 — Academia + bot "Mi Cabeza" (semanas 10–12)
- Upload a Cloudflare Stream, pipeline Whisper → chunks → pgvector.
- Chat RAG con citas timestamped y deep-links al reproductor.

### Fase 7 — Lienzo visual (semanas 12–13)
- tldraw embebido, autosave, plantillas estratégicas precargadas.

### Transversal
- Auditoría de accesos, Sentry, tests de las reglas de negocio (gates SOBA, 70/30, revocación), seeds de catálogos (industrias, SOPs, plantillas).

---

## 7. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Postura propuesta |
|---|---|---|
| 1 | La API de Skool es joven y puede no tener webhooks o lookup por email | Diseñar `auth/` contra una interfaz `MembershipProvider`; polling agresivo como fallback. Validar en Fase 1, no al final. |
| 2 | BYOK vs. créditos | Lanzar solo BYOK (cero riesgo financiero); el ledger de créditos ya queda modelado para activarlo después. |
| 3 | Whisper self-host vs. API | API primero (volumen bajo de clases); migrar si el costo por hora de video lo amerita. |
| 4 | Colaboración realtime en canvas/kanban | Fuera del MVP; el modelo de datos (JSON snapshots, position fraccional) no lo bloquea a futuro. |
| 5 | Multi-moneda en finanzas | Campo `currency` desde el día uno, pero reportes mono-moneda en MVP. |
