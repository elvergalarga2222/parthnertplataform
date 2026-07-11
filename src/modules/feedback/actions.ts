"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentPartner } from "@/modules/auth/service";
import { FeedbackError, createFeedback, isTester } from "./service";

export type ActionResult = { ok: true } | { ok: false; error: string };

const feedbackSchema = z.object({
  type: z.enum(["bug", "sugerencia"]),
  description: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres).").max(4000),
  route: z.string().trim().max(500),
});

export async function createFeedbackAction(
  input: z.input<typeof feedbackSchema>,
): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    // El gate se re-verifica server-side: el botón oculto no es suficiente.
    const partner = await getCurrentPartner();
    if (!partner || !isTester(partner)) {
      return { ok: false, error: "No autorizado." };
    }

    const store = await headers();
    await createFeedback(partner.id, {
      ...parsed.data,
      userAgent: store.get("user-agent"),
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof FeedbackError) return { ok: false, error: err.message };
    console.error("Feedback action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}
