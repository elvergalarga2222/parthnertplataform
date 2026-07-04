"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { getRedis } from "@/lib/redis";
import { requirePartner } from "@/modules/auth/require-partner";
import { AiGateway, RedisQuotaStore } from "@/modules/ai/gateway";

function gateway() {
  const masterKey = process.env.AI_KEYS_MASTER_KEY;
  if (!masterKey) {
    throw new Error("AI_KEYS_MASTER_KEY is not set");
  }
  return new AiGateway(getDb(), new RedisQuotaStore(getRedis()), masterKey);
}

const saveSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(20, "La API key parece incompleta"),
});

export async function saveKeyAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/ia?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  await gateway().saveKey(partner.id, parsed.data.provider, parsed.data.apiKey);
  revalidatePath("/ia");
  redirect("/ia?saved=1");
}

const deleteSchema = z.object({ provider: z.enum(["anthropic", "openai"]) });

export async function deleteKeyAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    await gateway().deleteKey(partner.id, parsed.data.provider);
  }
  revalidatePath("/ia");
  redirect("/ia");
}
