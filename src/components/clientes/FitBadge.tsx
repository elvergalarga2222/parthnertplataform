import type { FitLevel } from "@/modules/crm/types";

const FIT_STYLES: Record<FitLevel, string> = {
  bajo: "bg-surface-3 text-ink-secondary",
  medio: "bg-amber-400/15 text-amber-300",
  bueno: "bg-blue-400/15 text-blue-300",
  excelente: "bg-positive/15 text-positive",
};

export default function FitBadge({ fit }: { fit: FitLevel | null }) {
  if (!fit) return <span className="text-[11px] text-ink-muted">—</span>;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${FIT_STYLES[fit]}`}
    >
      {fit}
    </span>
  );
}
