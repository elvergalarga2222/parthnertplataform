import { NextResponse } from "next/server";
import { getCurrentPartner } from "@/modules/auth/service";
import { logger, newRequestId } from "@/lib/logger";

// Receives client-side error reports (from error boundaries) and writes them
// to the SERVER log, so failures that happen in the browser also show up in
// `pm2 logs` instead of vanishing into the user's console.
//
// Best-effort and defensive: it must never itself throw or leak.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FIELD = 4000;

function clip(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, MAX_FIELD);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Attach the partner if there is a session, but never fail if there isn't.
    let partnerId: string | undefined;
    try {
      const partner = await getCurrentPartner();
      partnerId = partner?.id;
    } catch {
      // ignore — logging must not depend on auth succeeding
    }

    logger.error("client_error", clip(body?.stack) ?? clip(body?.message), {
      requestId: newRequestId(),
      partnerId,
      source: "client",
      boundary: clip(body?.boundary),
      digest: clip(body?.digest),
      route: clip(body?.route),
      message: clip(body?.message),
      userAgent: clip(request.headers.get("user-agent") ?? undefined),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
