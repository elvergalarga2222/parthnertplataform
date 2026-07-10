import { getOverview } from "@/modules/admin/service";
import { formatMoney } from "@/lib/format";

export const metadata = { title: "Admin · Partner Manager" };
export const dynamic = "force-dynamic";

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <h3 className="text-[12px] font-medium text-ink-secondary">{title}</h3>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-[11px] text-ink-muted">{hint}</p>}
    </article>
  );
}

export default async function AdminOverviewPage() {
  const overview = await getOverview();
  const nf = (n: number) => n.toLocaleString("es-ES");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-lg font-bold tracking-tight">Resumen de la plataforma</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Partners activos" value={nf(overview.partnersActive)} />
        <Card
          title="Partners congelados"
          value={nf(overview.partnersFrozen)}
          hint="Datos conservados; solo acceso bloqueado"
        />
        <Card title="Espacios de cliente" value={nf(overview.workspacesTotal)} />
        <Card title="Deals" value={nf(overview.dealsTotal)} />
      </div>
      <h2 className="mt-2 text-[14px] font-bold tracking-tight">Consumo de IA</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Generaciones (30 días)" value={nf(overview.ai.generations30d)} />
        <Card title="Tokens (30 días)" value={nf(overview.ai.tokens30d)} />
        <Card
          title="Costo IA (30 días)"
          value={formatMoney(overview.ai.costUsd30d, "USD")}
          hint="Pagado por los partners (BYOK) — nunca por la plataforma"
        />
        <Card title="Costo IA (total)" value={formatMoney(overview.ai.costUsdTotal, "USD")} />
      </div>
    </div>
  );
}
