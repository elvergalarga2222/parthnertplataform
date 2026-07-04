"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { CrmSnapshot, DealView } from "@/modules/crm/types";
import { stageTotals } from "@/modules/crm/helpers";
import PipelineColumn from "./PipelineColumn";
import DealCard from "./DealCard";

export default function PipelineBoard({
  data,
  onMoveDeal,
  onOpenDeal,
}: {
  data: CrmSnapshot;
  onMoveDeal: (dealId: string, stageId: string, index: number) => void;
  onOpenDeal: (deal: DealView) => void;
}) {
  const [activeDeal, setActiveDeal] = useState<DealView | null>(null);

  // Distance constraint keeps plain clicks (open detail) from starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealView[]>();
    for (const stage of data.stages) map.set(stage.id, []);
    for (const deal of [...data.deals].sort((a, b) => a.position - b.position)) {
      map.get(deal.stageId)?.push(deal);
    }
    return map;
  }, [data.stages, data.deals]);

  const totals = useMemo(() => stageTotals(data.deals), [data.deals]);

  const findDeal = (id: string) => data.deals.find((d) => d.id === id) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDeal(findDeal(String(event.active.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = String(active.id);
    const overId = String(over.id);
    const deal = findDeal(dealId);
    if (!deal) return;

    let targetStageId: string;
    let targetIndex: number;

    if (overId.startsWith("stage:")) {
      targetStageId = overId.slice("stage:".length);
      targetIndex = (dealsByStage.get(targetStageId) ?? []).filter(
        (d) => d.id !== dealId,
      ).length;
    } else {
      const overDeal = findDeal(overId);
      if (!overDeal) return;
      targetStageId = overDeal.stageId;
      const column = (dealsByStage.get(targetStageId) ?? []).filter(
        (d) => d.id !== dealId,
      );
      targetIndex = column.findIndex((d) => d.id === overId);
      if (targetIndex === -1) targetIndex = column.length;
    }

    const currentColumn = dealsByStage.get(deal.stageId) ?? [];
    const currentIndex = currentColumn.findIndex((d) => d.id === dealId);
    if (targetStageId === deal.stageId && targetIndex === currentIndex) return;

    onMoveDeal(dealId, targetStageId, targetIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDeal(null)}
    >
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-3">
        {data.stages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage.get(stage.id) ?? []}
            total={totals[stage.id]?.total ?? 0}
            onOpenDeal={onOpenDeal}
          />
        ))}
        {data.stages.length === 0 && (
          <p className="m-auto text-[13px] text-ink-muted">
            No hay etapas todavía. Créalas desde el botón «Etapas».
          </p>
        )}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
