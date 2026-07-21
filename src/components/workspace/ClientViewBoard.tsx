import type { ClientView } from "@/modules/workspace/types";

// Server Component a propósito: la vista de cliente es read-only, no necesita
// estado ni interactividad, y así ninguna Server Action queda expuesta en el
// bundle de una página pública.

function formatDueDate(dueDate: string): string {
  // dueDate es 'YYYY-MM-DD'; se parsea a mediodía UTC para que la zona horaria
  // del cliente no lo desplace un día.
  return new Date(`${dueDate}T12:00:00Z`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientViewBoard({ view }: { view: ClientView }) {
  const totalCards = view.columns.reduce((sum, col) => sum + col.cards.length, 0);

  return (
    <div className="min-h-screen bg-base px-4 py-8 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-6xl">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-secondary">
          Avance del proyecto
        </p>
        <h1 className="mt-1 text-[22px] font-bold text-ink">{view.clientName}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
          Esta vista es de solo lectura y muestra únicamente las tareas que tu
          estratega marcó como visibles.
        </p>
      </header>

      <main className="mx-auto mt-8 max-w-6xl">
        {totalCards === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface p-8 text-center shadow-card">
            <p className="text-[14px] font-semibold text-ink">
              Todavía no hay nada que mostrar
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
              Cuando tu estratega publique avances, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.columns
              .filter((column) => column.cards.length > 0)
              .map((column) => (
                <section
                  key={column.id}
                  className="rounded-2xl border border-edge bg-surface p-4 shadow-card"
                >
                  <h2 className="flex items-center justify-between text-[13px] font-bold text-ink">
                    <span>{column.name}</span>
                    <span className="text-[12px] font-medium text-ink-secondary">
                      {column.cards.length}
                    </span>
                  </h2>

                  <ul className="mt-3 space-y-2">
                    {column.cards.map((card) => (
                      <li
                        key={card.id}
                        className="rounded-xl border border-edge bg-base p-3"
                      >
                        <p className="text-[13px] font-semibold text-ink">
                          {card.title}
                        </p>
                        {card.description && (
                          <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-secondary">
                            {card.description}
                          </p>
                        )}
                        {card.dueDate && (
                          <p className="mt-2 text-[11px] font-medium text-ink-secondary">
                            Fecha objetivo: {formatDueDate(card.dueDate)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
