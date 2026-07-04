import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { KANBAN_STATUSES, type KanbanStatus } from "@/db/schema";
import { requirePartner } from "@/modules/auth/require-partner";
import { WorkspaceService } from "@/modules/workspace/workspace-service";
import {
  createTaskAction,
  moveTaskAction,
  toggleSopAction,
  toggleVisibilityAction,
} from "../actions";

export const KANBAN_LABELS: Record<KanbanStatus, string> = {
  por_hacer: "Por hacer",
  en_proceso: "En proceso",
  en_estancamiento: "En estancamiento",
  finalizado: "Finalizado",
};

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const partner = await requirePartner();
  const { workspaceId } = await params;
  const svc = new WorkspaceService(getDb());

  const workspace = await svc.getWorkspace(partner.id, workspaceId);
  if (!workspace) {
    notFound();
  }
  const [tasks, sops] = await Promise.all([
    svc.listTasks(workspace.id),
    svc.listSops(workspace.id),
  ]);

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none";

  return (
    <main className="px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/workspace"
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Workspaces
            </Link>
            <h1 className="text-2xl font-semibold">{workspace.name}</h1>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Vista de Cliente (pública, capada):</p>
            <code className="text-zinc-300">/c/{workspace.clientViewToken}</code>
          </div>
        </header>

        {/* Kanban de implementación (tangibilización) */}
        <section className="grid gap-4 md:grid-cols-4">
          {KANBAN_STATUSES.map((status) => (
            <div key={status} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {KANBAN_LABELS[status]} (
                {tasks.filter((t) => t.status === status).length})
              </h2>
              {tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <div
                    key={task.id}
                    className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-zinc-400">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      {KANBAN_STATUSES.filter((s) => s !== status).map((s) => (
                        <form key={s} action={moveTaskAction}>
                          <input
                            type="hidden"
                            name="workspaceId"
                            value={workspace.id}
                          />
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
                            title={`Mover a ${KANBAN_LABELS[s]}`}
                          >
                            {KANBAN_LABELS[s]}
                          </button>
                        </form>
                      ))}
                    </div>
                    <form action={toggleVisibilityAction}>
                      <input
                        type="hidden"
                        name="workspaceId"
                        value={workspace.id}
                      />
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        className={`text-[10px] ${
                          task.isClientVisible
                            ? "text-emerald-400"
                            : "text-zinc-500"
                        }`}
                      >
                        {task.isClientVisible
                          ? "👁 Visible para el cliente"
                          : "🚫 Oculta al cliente"}
                      </button>
                    </form>
                  </div>
                ))}
            </div>
          ))}
        </section>

        {/* Nueva tarea */}
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 font-medium">Nueva tarea</h2>
          <form
            action={createTaskAction}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-sm text-zinc-300">Título</label>
              <input name="title" required className={inputClass} />
            </div>
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-sm text-zinc-300">
                Descripción
              </label>
              <input name="description" className={inputClass} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
              <input type="checkbox" name="isClientVisible" defaultChecked />
              Visible para el cliente
            </label>
            <button className="rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
              Agregar
            </button>
          </form>
        </section>

        {/* SOPs y prompts inyectados */}
        <section className="space-y-3">
          <h2 className="font-medium">Guía de operación (SOPs y prompts)</h2>
          {sops.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay SOPs en el catálogo todavía (corre npm run db:seed).
            </p>
          ) : (
            sops.map((sop) => (
              <details
                key={sop.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <summary className="flex cursor-pointer items-center justify-between">
                  <span
                    className={
                      sop.completedAt ? "text-zinc-500 line-through" : ""
                    }
                  >
                    {sop.kind === "ai_prompt" ? "🤖" : "📋"} {sop.title}
                  </span>
                  <form action={toggleSopAction}>
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input type="hidden" name="sopId" value={sop.id} />
                    <button className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800">
                      {sop.completedAt ? "Reabrir" : "Completar"}
                    </button>
                  </form>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
                  {sop.body}
                </p>
              </details>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
