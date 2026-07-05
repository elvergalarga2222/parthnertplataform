"use client";

import { useMemo } from "react";
import type { CrmSnapshot, DealView } from "@/modules/crm/types";
import { formatMoney, stageTotals } from "@/modules/crm/helpers";
import KanbanBoard, {
  type KanbanColumnDef,
} from "@/components/kanban/KanbanBoard";
import { STAGE_COLORS } from "./stage-colors";
import DealCard from "./DealCard";

// Deals adapted to the generic board's item shape (columnId = stageId).
type DealItem = DealView & { columnId: string };

export default function PipelineBoard({
  data,
  onMoveDeal,
  onOpenDeal,
}: {
  data: CrmSnapshot;
  onMoveDeal: (dealId: string, stageId: string, index: number) => void;
  onOpenDeal: (deal: DealView) => void;
}) {
  const items = useMemo<DealItem[]>(
    () => data.deals.map((deal) => ({ ...deal, columnId: deal.stageId })),
    [data.deals],
  );

  const totals = useMemo(() => stageTotals(data.deals), [data.deals]);

  const columns = useMemo<KanbanColumnDef[]>(
    () =>
      data.stages.map((stage) => {
        const color = STAGE_COLORS[stage.color] ?? STAGE_COLORS.gray;
        const stageStats = totals[stage.id];
        return {
          id: stage.id,
          label: `Etapa ${stage.name}`,
          header: (
            <>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color.dot }}
              />
              <h2 className="truncate text-[13px] font-bold">{stage.name}</h2>
              <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-secondary">
                {stageStats?.count ?? 0}
              </span>
              <span className="ml-auto shrink-0 text-[12px] font-semibold text-ink-secondary">
                {formatMoney(stageStats?.total ?? 0)}
              </span>
            </>
          ),
        };
      }),
    [data.stages, totals],
  );

  return (
    <KanbanBoard
      columns={columns}
      items={items}
      onMove={onMoveDeal}
      onOpenItem={onOpenDeal}
      renderCard={(item, overlay) => <DealCard deal={item} overlay={overlay} />}
      emptyColumnHint="Arrastra deals aquí"
      emptyBoardHint="No hay etapas todavía. Créalas desde el botón «Etapas»."
    />
  );
}
