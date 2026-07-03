import Link from "next/link";
import { getDb } from "@/db";
import { getRedis } from "@/lib/redis";
import { requirePartner } from "@/modules/auth/require-partner";
import { AiGateway, DAILY_REQUEST_QUOTA, RedisQuotaStore } from "@/modules/ai/gateway";
import { deleteKeyAction, saveKeyAction } from "./actions";

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const partner = await requirePartner();
  const { error, saved } = await searchParams;

  const masterKey = process.env.AI_KEYS_MASTER_KEY ?? "";
  const gateway = masterKey
    ? new AiGateway(getDb(), new RedisQuotaStore(getRedis()), masterKey)
    : null;
  const keys = gateway ? await gateway.listKeys(partner.id) : [];
  const credits = gateway ? await gateway.creditBalance(partner.id) : 0;

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">IA — Tu API key (BYOK)</h1>
          <p className="text-sm text-zinc-400">
            La plataforma nunca paga tokens: el copiloto, el editor y el bot
            usan tu propia key de Anthropic u OpenAI. Se guarda cifrada
            (AES-256-GCM) y nunca se muestra completa.
          </p>
        </header>

        {error && (
          <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
            Key guardada y cifrada.
          </p>
        )}
        {!masterKey && (
          <p className="rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
            AI_KEYS_MASTER_KEY no está configurada en el servidor; el módulo de
            IA está deshabilitado.
          </p>
        )}

        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="font-medium">Keys configuradas</h2>
          {keys.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sin keys. Agrega una para habilitar las funciones de IA.
            </p>
          ) : (
            keys.map((k) => (
              <div
                key={k.provider}
                className="flex items-center justify-between border-t border-zinc-800 py-2"
              >
                <div>
                  <p className="text-sm capitalize">{k.provider}</p>
                  <p className="text-xs text-zinc-500">
                    ····{k.keyLast4}{" "}
                    {!k.isValid && (
                      <span className="text-red-400">
                        (inválida — el proveedor la rechazó)
                      </span>
                    )}
                  </p>
                </div>
                <form action={deleteKeyAction}>
                  <input type="hidden" name="provider" value={k.provider} />
                  <button className="rounded border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950">
                    Eliminar
                  </button>
                </form>
              </div>
            ))
          )}
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-medium">Agregar / reemplazar key</h2>
          <form action={saveKeyAction} className="space-y-3">
            <select name="provider" className={inputClass} required>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
            <input
              name="apiKey"
              type="password"
              placeholder="sk-…"
              required
              className={inputClass}
            />
            <button className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
              Guardar cifrada
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
          <p>
            Créditos prepagados: <span className="text-white">{credits}</span>{" "}
            (se usan solo si no tienes key propia).
          </p>
          <p className="mt-1">
            Cuota de seguridad: {DAILY_REQUEST_QUOTA} llamadas de IA al día.
          </p>
        </section>
      </div>
    </main>
  );
}
