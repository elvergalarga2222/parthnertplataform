"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { DealView, StageView } from "@/modules/crm/types";
import { formatMoney } from "@/modules/crm/helpers";
import { STAGE_COLORS } from "./stage-colors";
import SortableDealCard from "./SortableDealCard";

export default function PipelineColumn({
  stage,
  deals,
  total,
  onOpenDeal,
}: {
  stage: StageView;
  deals: DealView[];
  total: number;
  onOpenDeal: (deal: DealView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  const color = STAGE_COLORS[stage.color] ?? STAGE_COLORS.gray;

  return (
    <section
      aria-label={`Etapa ${stage.name}`}
      className="flex h-full w-72 shrink-0 flex-col rounded-2xl border border-edge bg-surface"
    >
      <header className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color.dot }}
        />
        <h2 className="truncate text-[13px] font-bold">{stage.name}</h2>
        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-secondary">
          {deals.length}
        </span>
        <span className="ml-auto shrink-0 text-[12px] font-semibold text-ink-secondary">
          {formatMoney(total)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto p-3 transition-colors duration-150 ${
          isOver ? "bg-primary-faint" : ""
        }`}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} onOpen={onOpenDeal} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <p className="m-auto py-6 text-center text-[11.5px] text-ink-muted">
            Arrastra deals aquí
          </p>
        )}
      </div>
    </section>
  );
}
