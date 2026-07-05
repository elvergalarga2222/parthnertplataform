"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Generic dnd-kit board shared by the CRM pipeline (deals) and the workspace
// operational kanban (cards). Owns all drag & drop mechanics; consumers only
// provide column headers, a card renderer and the onMove callback.

export interface KanbanItem {
  id: string;
  columnId: string;
  position: number;
}

export interface KanbanColumnDef {
  id: string;
  /** Accessible name for the column (aria-label of its section). */
  label: string;
  /** Rendered inside the column header bar. */
  header: ReactNode;
  /** Optional click handler for the header (e.g. select column for SOP). */
  onHeaderClick?: () => void;
  headerSelected?: boolean;
}

const COLUMN_PREFIX = "col:";

export default function KanbanBoard<T extends KanbanItem>({
  columns,
  items,
  onMove,
  onOpenItem,
  renderCard,
  emptyColumnHint = "Arrastra tarjetas aquí",
  emptyBoardHint = "No hay columnas todavía.",
}: {
  columns: KanbanColumnDef[];
  items: T[];
  onMove: (itemId: string, columnId: string, index: number) => void;
  onOpenItem?: (item: T) => void;
  renderCard: (item: T, overlay: boolean) => ReactNode;
  emptyColumnHint?: string;
  emptyBoardHint?: string;
}) {
  const [activeItem, setActiveItem] = useState<T | null>(null);

  // Distance constraint keeps plain clicks (open detail) from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const column of columns) map.set(column.id, []);
    for (const item of [...items].sort((a, b) => a.position - b.position)) {
      map.get(item.columnId)?.push(item);
    }
    return map;
  }, [columns, items]);

  const findItem = (id: string) => items.find((i) => i.id === id) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(findItem(String(event.active.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const item = findItem(itemId);
    if (!item) return;

    let targetColumnId: string;
    let targetIndex: number;

    if (overId.startsWith(COLUMN_PREFIX)) {
      targetColumnId = overId.slice(COLUMN_PREFIX.length);
      targetIndex = (itemsByColumn.get(targetColumnId) ?? []).filter(
        (i) => i.id !== itemId,
      ).length;
    } else {
      const overItem = findItem(overId);
      if (!overItem) return;
      targetColumnId = overItem.columnId;
      const column = (itemsByColumn.get(targetColumnId) ?? []).filter(
        (i) => i.id !== itemId,
      );
      targetIndex = column.findIndex((i) => i.id === overId);
      if (targetIndex === -1) targetIndex = column.length;
    }

    const currentColumn = itemsByColumn.get(item.columnId) ?? [];
    const currentIndex = currentColumn.findIndex((i) => i.id === itemId);
    if (targetColumnId === item.columnId && targetIndex === currentIndex) return;

    onMove(itemId, targetColumnId, targetIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveItem(null)}
    >
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-3">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            items={itemsByColumn.get(column.id) ?? []}
            onOpenItem={onOpenItem}
            renderCard={renderCard}
            emptyColumnHint={emptyColumnHint}
          />
        ))}
        {columns.length === 0 && (
          <p className="m-auto text-[13px] text-ink-muted">{emptyBoardHint}</p>
        )}
      </div>
      <DragOverlay>
        {activeItem ? renderCard(activeItem, true) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn<T extends KanbanItem>({
  column,
  items,
  onOpenItem,
  renderCard,
  emptyColumnHint,
}: {
  column: KanbanColumnDef;
  items: T[];
  onOpenItem?: (item: T) => void;
  renderCard: (item: T, overlay: boolean) => ReactNode;
  emptyColumnHint: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_PREFIX}${column.id}`,
  });

  const header = (
    <div className="flex w-full items-center gap-2">{column.header}</div>
  );

  return (
    <section
      aria-label={column.label}
      className={`flex h-full w-72 shrink-0 flex-col rounded-2xl border bg-surface transition-colors duration-150 ${
        column.headerSelected ? "border-primary/50" : "border-edge"
      }`}
    >
      {column.onHeaderClick ? (
        <button
          type="button"
          onClick={column.onHeaderClick}
          className="border-b border-edge px-4 py-3 text-left transition-colors hover:bg-surface-2"
        >
          {header}
        </button>
      ) : (
        <header className="border-b border-edge px-4 py-3">{header}</header>
      )}

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto p-3 transition-colors duration-150 ${
          isOver ? "bg-primary-faint" : ""
        }`}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              onOpen={onOpenItem}
              renderCard={renderCard}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <p className="m-auto py-6 text-center text-[11.5px] text-ink-muted">
            {emptyColumnHint}
          </p>
        )}
      </div>
    </section>
  );
}

function SortableCard<T extends KanbanItem>({
  item,
  onOpen,
  renderCard,
}: {
  item: T;
  onOpen?: (item: T) => void;
  renderCard: (item: T, overlay: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.(item);
      }}
      className="cursor-grab outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 active:cursor-grabbing"
    >
      {renderCard(item, false)}
    </div>
  );
}
