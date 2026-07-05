"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentPartner } from "@/modules/auth/service";
import {
  AiError,
  deletePartnerKey,
  generate,
  getKeyStatus,
  getPrompts,
  getRecentGenerations,
  getUsage,
  setPartnerKey,
} from "./service";
import {
  AI_TYPES,
  type AiGenerationView,
  type AiKeyStatus,
  type AiPromptView,
  type AiType,
  type AiUsageView,
} from "./types";

export interface AiBootstrap {
  usage: AiUsageView;
  keyStatus: AiKeyStatus;
  requiresKey: boolean;
  promptsByType: Record<AiType, AiPromptView[]>;
  recentByType: Record<AiType, AiGenerationView[]>;
}

export type AiActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

async function requirePartnerId(): Promise<string> {
  const partner = await getCurrentPartner();
  if (!partner) throw new AiError("Sesión no válida.");
  return partner.id;
}

export async function getAiBootstrapAction(
  workspaceId: string,
): Promise<AiActionResult<AiBootstrap>> {
  try {
    const partnerId = await requirePartnerId();
    const wsId = z.string().uuid().safeParse(workspaceId).success
      ? workspaceId
      : null;

    const [usage, keyStatus] = await Promise.all([
      getUsage(partnerId),
      getKeyStatus(partnerId),
    ]);

    const promptsByType = {} as Record<AiType, AiPromptView[]>;
    const recentByType = {} as Record<AiType, AiGenerationView[]>;
    for (const type of AI_TYPES) {
      promptsByType[type] = await getPrompts(partnerId, type);
      recentByType[type] = await getRecentGenerations(partnerId, type, wsId);
    }

    return {
      ok: true,
      data: {
        usage,
        keyStatus,
        // In production the partner must supply a BYOK key; in dev/mock it's optional.
        requiresKey: process.env.AI_PROVIDER === "anthropic",
        promptsByType,
        recentByType,
      },
    };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    console.error("AI bootstrap action error:", err);
    return { ok: false, error: "No se pudo cargar el módulo de IA." };
  }
}

const generateSchema = z.object({
  type: z.enum(AI_TYPES),
  promptId: z.string().uuid().nullish(),
  workspaceId: z.string().uuid().nullish(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export async function generateAction(
  input: z.input<typeof generateSchema>,
): Promise<AiActionResult<AiGenerationView>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    const partnerId = await requirePartnerId();
    const data = await generate(partnerId, parsed.data);
    revalidatePath("/espacios");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message, code: err.code };
    console.error("AI generate action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

const keySchema = z.object({
  apiKey: z.string().trim().min(20, "La API key parece demasiado corta.").max(200),
});

export async function setKeyAction(
  input: z.input<typeof keySchema>,
): Promise<AiActionResult> {
  const parsed = keySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "API key inválida." };
  }
  try {
    const partnerId = await requirePartnerId();
    await setPartnerKey(partnerId, parsed.data.apiKey);
    revalidatePath("/espacios");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    console.error("AI setKey action error:", err);
    return { ok: false, error: "No se pudo guardar la API key." };
  }
}

export async function deleteKeyAction(): Promise<AiActionResult> {
  try {
    const partnerId = await requirePartnerId();
    await deletePartnerKey(partnerId);
    revalidatePath("/espacios");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof AiError) return { ok: false, error: err.message };
    console.error("AI deleteKey action error:", err);
    return { ok: false, error: "No se pudo eliminar la API key." };
  }
}
