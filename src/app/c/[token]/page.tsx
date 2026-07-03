import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { KANBAN_STATUSES, type KanbanStatus } from "@/db/schema";
import { WorkspaceService } from "@/modules/workspace/workspace-service";

const LABELS: Record<KanbanStatus, string> = {
  por_hacer: "Por hacer",
  en_proceso: "En proceso",
  en_estancamiento: "En estancamiento",
  finalizado: "Finalizado",
};

// Vista de Cliente pública (regla de negocio #7): sin login, read-only, solo
// tareas con is_client_visible = true. Nada más de la plataforma se expone.
export default async function ClientViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await new WorkspaceService(getDb()).getClientView(token);
  if (!view) {
    notFound();
  }

  const done = view.tasks.filter((t) => t.status === "finalizado").length;
  const progress =
    view.tasks.length > 0 ? Math.round((done / view.tasks.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{view.clientName}</h1>
          <p className="text-sm text-zinc-400">
            Progreso real de tu proyecto — actualizado en vivo.
          </p>
          <div className="mx-auto max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {done} de {view.tasks.length} tareas finalizadas ({progress}%)
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {KANBAN_STATUSES.map((status) => (
            <section key={status} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {LABELS[status]}
              </h2>
              {view.tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <p className="text-sm">{task.title}</p>
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Entrega: {task.dueDate}
                      </p>
                    )}
                  </div>
                ))}
            </section>
          ))}
        </div>

        <footer className="text-center text-xs text-zinc-600">
          Vista de solo lectura generada por Partner Manager.
        </footer>
      </div>
    </main>
  );
}
