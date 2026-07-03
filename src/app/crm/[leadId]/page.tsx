import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { LEAD_STAGES, type LeadStage } from "@/db/schema";
import { requirePartner } from "@/modules/auth/require-partner";
import { LeadService } from "@/modules/crm/lead-service";
import { requiredFieldsFor, SOBA_FIELD_LABELS } from "@/modules/crm/pipeline";
import { openWorkspaceAction } from "@/app/workspace/actions";
import { changeStageAction, updateSobaAction } from "../actions";
import { STAGE_LABELS, StageBadge } from "../stage-badge";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ gate?: string; saved?: string }>;
}) {
  const partner = await requirePartner();
  const { leadId } = await params;
  const { gate, saved } = await searchParams;

  const lead = await new LeadService(getDb()).getLead(partner.id, leadId);
  if (!lead) {
    notFound();
  }

  const stage = lead.stage as LeadStage;
  const stageIndex = LEAD_STAGES.indexOf(stage);
  const isClosed = stage === "cerrado_ganado" || stage === "cerrado_perdido";
  const nextStage = !isClosed ? LEAD_STAGES[stageIndex + 1] : undefined;
  const prevStage =
    !isClosed && stageIndex > 0 ? LEAD_STAGES[stageIndex - 1] : undefined;

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <Link href="/crm" className="text-sm text-zinc-400 hover:text-white">
            ← Volver al pipeline
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{lead.businessName}</h1>
            <StageBadge stage={stage} />
          </div>
          {lead.contactName && (
            <p className="text-sm text-zinc-400">
              {lead.contactName}
              {lead.contactEmail ? ` · ${lead.contactEmail}` : ""}
              {lead.contactPhone ? ` · ${lead.contactPhone}` : ""}
            </p>
          )}
        </header>

        {gate && (
          <p className="rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
            🚧 {gate}
          </p>
        )}
        {saved && (
          <p className="rounded-md border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
            Campos SOBA guardados.
          </p>
        )}

        {stage === "cerrado_ganado" && (
          <form action={openWorkspaceAction}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
              🎉 Abrir workspace del cliente
            </button>
          </form>
        )}

        {!isClosed && (
          <section className="flex flex-wrap gap-2">
            {nextStage && nextStage !== "cerrado_perdido" && (
              <form action={changeStageAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="to" value={nextStage} />
                <button className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
                  Avanzar a {STAGE_LABELS[nextStage]} →
                </button>
              </form>
            )}
            {prevStage && (
              <form action={changeStageAction}>
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="to" value={prevStage} />
                <button className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900">
                  ← Regresar a {STAGE_LABELS[prevStage]}
                </button>
              </form>
            )}
            <form action={changeStageAction}>
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="to" value="cerrado_perdido" />
              <button className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950">
                Marcar perdido
              </button>
            </form>
          </section>
        )}

        <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div>
            <h2 className="font-medium">Metodología SOBA/NOVA</h2>
            <p className="text-xs text-zinc-500">
              {nextStage && requiredFieldsFor(nextStage).length > 0
                ? `Para avanzar a ${STAGE_LABELS[nextStage]} se exige: ${requiredFieldsFor(
                    nextStage,
                  )
                    .map((f) => SOBA_FIELD_LABELS[f])
                    .join(" · ")}`
                : "Completa estos campos para poder avanzar el lead por el pipeline."}
            </p>
          </div>
          <form action={updateSobaAction} className="space-y-3">
            <input type="hidden" name="leadId" value={lead.id} />
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                {SOBA_FIELD_LABELS.sobaSegment}
              </label>
              <input
                name="sobaSegment"
                defaultValue={lead.sobaSegment ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                {SOBA_FIELD_LABELS.sobaOfferPointA}
              </label>
              <textarea
                name="sobaOfferPointA"
                rows={2}
                defaultValue={lead.sobaOfferPointA ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                {SOBA_FIELD_LABELS.sobaOfferPointB}
              </label>
              <textarea
                name="sobaOfferPointB"
                rows={2}
                defaultValue={lead.sobaOfferPointB ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                {SOBA_FIELD_LABELS.sobaVehicle}
              </label>
              <select
                name="sobaVehicle"
                defaultValue={lead.sobaVehicle ?? ""}
                className={inputClass}
              >
                <option value="">Sin definir…</option>
                <option value="consultoria">Consultoría (alto valor)</option>
                <option value="asesoria_mensual">Asesoría mensual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-300">
                {SOBA_FIELD_LABELS.sobaAttention}
              </label>
              <textarea
                name="sobaAttention"
                rows={2}
                defaultValue={lead.sobaAttention ?? ""}
                className={inputClass}
              />
            </div>
            <button className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-white hover:bg-zinc-800">
              Guardar campos SOBA
            </button>
          </form>
        </section>

        {lead.notes && (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-1 font-medium">Notas</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              {lead.notes}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
