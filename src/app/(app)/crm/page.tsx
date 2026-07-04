import Link from "next/link";
import { getDb } from "@/db";
import { LEAD_STAGES } from "@/db/schema";
import { requirePartner } from "@/modules/auth/require-partner";
import { LeadService } from "@/modules/crm/lead-service";
import { STAGE_LABELS } from "./stage-badge";

export default async function CrmPage() {
  const partner = await requirePartner();
  const rows = await new LeadService(getDb()).listLeads(partner.id);

  const byStage = LEAD_STAGES.map((stage) => ({
    stage,
    leads: rows.filter((r) => r.lead.stage === stage),
  }));

  return (
    <main className="px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">CRM — Pipeline SOBA/NOVA</h1>
            <p className="text-sm text-zinc-400">
              {rows.length} lead{rows.length === 1 ? "" : "s"} en tu entorno
              privado.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Dashboard
            </Link>
            <Link
              href="/crm/nuevo"
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              + Nuevo lead
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {byStage.map(({ stage, leads }) => (
            <section key={stage} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {STAGE_LABELS[stage]} ({leads.length})
              </h2>
              {leads.map(({ lead, industryName }) => (
                <Link
                  key={lead.id}
                  href={`/crm/${lead.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition hover:border-zinc-600"
                >
                  <p className="text-sm font-medium">{lead.businessName}</p>
                  <p className="text-xs text-zinc-400">{industryName}</p>
                  {lead.estimatedValue && (
                    <p className="mt-1 text-xs text-zinc-500">
                      ${lead.estimatedValue}
                    </p>
                  )}
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
