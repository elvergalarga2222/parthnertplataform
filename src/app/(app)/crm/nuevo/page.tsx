import Link from "next/link";
import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { LeadService } from "@/modules/crm/lead-service";
import { createLeadAction } from "../actions";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePartner();
  const { error } = await searchParams;
  const industries = await new LeadService(getDb()).listIndustries();

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none";

  return (
    <main className="px-6 py-10 text-white">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <Link href="/crm" className="text-sm text-zinc-400 hover:text-white">
            ← Volver al pipeline
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Nuevo lead</h1>
          <p className="text-sm text-zinc-400">
            La industria es obligatoria y viene de un catálogo mainstream — sin
            micronichos.
          </p>
        </header>

        {error && (
          <p className="rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <form action={createLeadAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Nombre del negocio *
            </label>
            <input name="businessName" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Industria *
            </label>
            <select name="industryId" required className={inputClass}>
              <option value="">Selecciona una industria…</option>
              {industries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                Contacto
              </label>
              <input name="contactName" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                Teléfono
              </label>
              <input name="contactPhone" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Email</label>
            <input name="contactEmail" type="email" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Valor estimado (USD)
            </label>
            <input
              name="estimatedValue"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Notas</label>
            <textarea name="notes" rows={3} className={inputClass} />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-white px-3 py-2 font-medium text-zinc-950 hover:bg-zinc-200"
          >
            Crear lead
          </button>
        </form>
      </div>
    </main>
  );
}
