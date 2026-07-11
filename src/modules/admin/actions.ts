"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/modules/auth/admin";
import {
  AuthError,
  freezePartner,
  unfreezePartner,
  type Partner,
} from "@/modules/auth/service";
import { AdminError, clearErrorLogs } from "./service";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Toda action re-verifica admin server-side — nunca confiar en que "la ruta
// está oculta".
async function requireAdmin(): Promise<Partner> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AdminError("No autorizado.");
  return admin;
}

async function run(fn: (admin: Partner) => Promise<void>): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await fn(admin);
    revalidatePath("/admin");
    revalidatePath("/admin/partners");
    revalidatePath("/admin/logs");
    return { ok: true };
  } catch (err) {
    if (err instanceof AdminError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error("Admin action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

export async function freezePartnerAction(partnerId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(partnerId);
  if (!parsed.success) return { ok: false, error: "Partner inválido." };
  return run((admin) =>
    freezePartner(parsed.data, { adminEmail: admin.email }),
  );
}

export async function unfreezePartnerAction(
  partnerId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(partnerId);
  if (!parsed.success) return { ok: false, error: "Partner inválido." };
  return run((admin) =>
    unfreezePartner(parsed.data, { adminEmail: admin.email }),
  );
}

export async function clearErrorLogsAction(): Promise<ActionResult> {
  return run(async () => {
    await clearErrorLogs();
  });
}
