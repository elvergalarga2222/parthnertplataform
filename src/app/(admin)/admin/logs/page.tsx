import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/modules/auth/admin";
import { getErrorLogs, listPartners } from "@/modules/admin/service";
import AdminLogsView from "@/components/admin/AdminLogsView";

export const metadata = { title: "Admin · Logs" };
export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  // Re-check local además del gate heredado del layout (admin) — mismo
  // patrón defensivo que el resto del panel: nunca confiar en que la ruta
  // ya está protegida por otra capa.
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/dashboard");

  const [entries, partners] = await Promise.all([getErrorLogs(), listPartners()]);
  const partnerEmails = Object.fromEntries(partners.map((p) => [p.id, p.email]));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Logs de errores</h1>
        <p className="mt-1 text-[12px] text-ink-muted">
          Atajo rápido para errores menores — NO reemplaza <code>pm2 logs</code>/
          <code>docker logs</code>. Buffer acotado y best-effort.
        </p>
      </div>
      <AdminLogsView entries={entries} partnerEmails={partnerEmails} />
    </div>
  );
}
