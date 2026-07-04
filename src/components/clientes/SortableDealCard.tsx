"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DealView } from "@/modules/crm/types";
import DealCard from "./DealCard";

export default function SortableDealCard({
  deal,
  onOpen,
}: {
  deal: DealView;
  onOpen: (deal: DealView) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });

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
      aria-label={`Deal ${deal.title}`}
      onClick={() => onOpen(deal)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(deal);
      }}
      className="cursor-grab outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 active:cursor-grabbing"
    >
      <DealCard deal={deal} />
    </div>
  );
}
