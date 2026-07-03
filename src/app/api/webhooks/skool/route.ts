import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthService } from "@/modules/auth";

// Canal primario de revocación (Épica 1). El shape exacto de los eventos de
// Skool está por validar (riesgo #1); este handler acepta el formato
// documentado y responde 200 a eventos desconocidos para no acumular
// reintentos del emisor.
const eventSchema = z.object({
  type: z.string(),
  member: z.object({ id: z.string() }).passthrough(),
});

const REVOCATION_EVENTS = new Set([
  "member.removed",
  "member.churned",
  "member.cancelled",
]);

export async function POST(request: Request) {
  const secret = process.env.SKOOL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const provided = request.headers.get("x-skool-webhook-secret") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { type, member } = parsed.data;
  if (REVOCATION_EVENTS.has(type)) {
    await getAuthService().revokeBySkoolMemberId(member.id, "webhook");
  }

  return NextResponse.json({ ok: true });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
