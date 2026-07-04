import Link from "next/link";
import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { WorkspaceService } from "@/modules/workspace/workspace-service";

export default async function WorkspacesPage() {
  const partner = await requirePartner();
  const rows = await new WorkspaceService(getDb()).listWorkspaces(partner.id);

  return (
    <main className="px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Workspaces</h1>
            <p className="text-sm text-zinc-400">
              Un espacio de operación por cada cliente cerrado.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Dashboard
          </Link>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
            Aún no tienes clientes. Cierra un lead como{" "}
            <span className="text-emerald-300">ganado</span> en el{" "}
            <Link href="/crm" className="underline">
              CRM
            </Link>{" "}
            y ábrele su workspace.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map(({ workspace, client }) => (
              <Link
                key={workspace.id}
                href={`/workspace/${workspace.id}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600"
              >
                <h2 className="font-medium">{client.name}</h2>
                <p className="text-xs text-zinc-500">
                  Creado el{" "}
                  {new Date(workspace.createdAt).toLocaleDateString("es")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
