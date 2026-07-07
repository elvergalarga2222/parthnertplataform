import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { upsertInvoiceFromWebhook } from "@/modules/finance/service";
import { CURRENCIES } from "@/modules/finance/types";
import type { Currency } from "@/modules/finance/types";
import { logger, newRequestId } from "@/lib/logger";

// Protected webhook for the external automation (n8n). Lets a payment confirmed
// over WhatsApp mark an invoice 'pagado' without the partner touching the UI.
// This is ONLY the receiving endpoint — the n8n flow lives outside the repo.
//
// Auth: a shared service secret in the Authorization: Bearer header, compared in
// constant time. NOT a partner session — the body's partnerId selects the tenant.
// Idempotent by (partnerId, externalRef): replays never duplicate an invoice.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  partnerId: z.string().uuid(),
  externalRef: z.string().min(1).max(200),
  clientName: z.string().min(1).max(200),
  amount: z.number().nonnegative(),
  currency: z.enum(CURRENCIES as [Currency, ...Currency[]]).optional(),
  status: z.enum(["pendiente", "pagado", "vencido"]).optional(),
  issuedAt: z.string().date().optional(),
  dueDate: z.string().date().nullish(),
  paidAt: z.string().datetime().nullish(),
  description: z.string().max(2000).nullish(),
  workspaceId: z.string().uuid().nullish(),
});

/** Constant-time compare of two secrets (hash first so lengths never leak). */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-webhook-secret");
}

export async function POST(request: Request) {
  const requestId = newRequestId();
  const secret = process.env.FINANCE_WEBHOOK_SECRET;

  // Fail closed: a missing/blank secret means the webhook is not configured and
  // must never accept writes.
  if (!secret) {
    logger.error("invoice_webhook_unconfigured", undefined, { requestId });
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const token = extractToken(request);
  if (!token || !secretMatches(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Resolve the tenant. Frozen partners are blocked (regla #2: congelar bloquea
  // todo); an unknown partner is a 404.
  const [partner] = await db
    .select({ id: partners.id, status: partners.status, defaultCurrency: partners.defaultCurrency })
    .from(partners)
    .where(eq(partners.id, input.partnerId))
    .limit(1);

  if (!partner) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }
  if (partner.status !== "active") {
    return NextResponse.json({ error: "partner_frozen" }, { status: 403 });
  }

  try {
    const result = await upsertInvoiceFromWebhook(
      partner.id,
      input,
      (CURRENCIES as string[]).includes(partner.defaultCurrency)
        ? (partner.defaultCurrency as Currency)
        : "USD",
    );
    logger.info("invoice_webhook_ok", {
      requestId,
      partnerId: partner.id,
      externalRef: input.externalRef,
      created: result.created,
    });
    return NextResponse.json(
      { ok: true, id: result.id, created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    logger.error(
      "invoice_webhook_failed",
      err instanceof Error ? err.message : String(err),
      { requestId, partnerId: partner.id },
    );
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
