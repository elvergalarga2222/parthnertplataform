"use client";

import { useMemo } from "react";
import { BookOpenText, CalendarClock, UserRound } from "lucide-react";
import type {
  WorkspaceCardView,
  WorkspaceSnapshot,
} from "@/modules/workspace/types";
import KanbanBoard, {
  type KanbanColumnDef,
} from "@/components/kanban/KanbanBoard";

// Reuses the same generic dnd-kit board as the CRM pipeline; only the data
// source (kanban_cards) and the card renderer change.
export default function WorkspaceKanban({
  data,
  selectedColumnId,
  onSelectColumn,
  onMoveCard,
  onOpenCard,
}: {
  data: WorkspaceSnapshot;
  selectedColumnId: string | null;
  onSelectColumn: (columnId: string) => void;
  onMoveCard: (cardId: string, columnId: string, index: number) => void;
  onOpenCard: (card: WorkspaceCardView) => void;
}) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of data.cards) map[card.columnId] = (map[card.columnId] ?? 0) + 1;
    return map;
  }, [data.cards]);

  const columns = useMemo<KanbanColumnDef[]>(
    () =>
      data.columns.map((column) => ({
        id: column.id,
        label: `Columna ${column.name}`,
        headerSelected: column.id === selectedColumnId,
        onHeaderClick: () => onSelectColumn(column.id),
        header: (
          <>
            <h2 className="truncate text-[13px] font-bold">{column.name}</h2>
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-secondary">
              {counts[column.id] ?? 0}
            </span>
            {column.sopContent && (
              <span
                title="Esta columna tiene SOP"
                className="ml-auto text-primary-soft"
              >
                <BookOpenText size={13} />
              </span>
            )}
          </>
        ),
      })),
    [data.columns, counts, selectedColumnId, onSelectColumn],
  );

  return (
    <KanbanBoard
      columns={columns}
      items={data.cards}
      onMove={onMoveCard}
      onOpenItem={onOpenCard}
      renderCard={(card, overlay) => (
        <WorkspaceCardTile card={card} overlay={overlay} />
      )}
      emptyColumnHint="Arrastra tareas aquí"
      emptyBoardHint="No hay columnas. Créalas desde «Columnas»."
    />
  );
}

function WorkspaceCardTile({
  card,
  overlay,
}: {
  card: WorkspaceCardView;
  overlay: boolean;
}) {
  const overdue =
    card.dueDate !== null && new Date(card.dueDate) < new Date(new Date().toDateString());

  return (
    <article
      className={`rounded-xl border bg-surface-2 p-3.5 transition-all duration-150 ${
        overlay
          ? "rotate-2 border-primary/60 shadow-card-hover"
          : "border-edge hover:border-primary/40 hover:shadow-card"
      }`}
    >
      <h3 className="text-[13px] font-semibold leading-snug">{card.title}</h3>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-ink-secondary">
          {card.description}
        </p>
      )}
      {(card.assignee || card.dueDate) && (
        <div className="mt-2.5 flex items-center gap-3 border-t border-edge pt-2.5 text-[11px] text-ink-muted">
          {card.assignee && (
            <span className="flex min-w-0 items-center gap-1">
              <UserRound size={11} className="shrink-0" />
              <span className="truncate">{card.assignee}</span>
            </span>
          )}
          {card.dueDate && (
            <span
              className={`ml-auto flex shrink-0 items-center gap-1 ${
                overdue ? "font-semibold text-negative" : ""
              }`}
            >
              <CalendarClock size={11} />
              {new Date(`${card.dueDate}T12:00:00`).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
