import type { LeadStage } from "@/db/schema";

export const STAGE_LABELS: Record<LeadStage, string> = {
  prospecto: "Prospecto",
  calificado: "Calificado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  cerrado_ganado: "Cerrado ganado",
  cerrado_perdido: "Cerrado perdido",
};

const STAGE_STYLES: Record<LeadStage, string> = {
  prospecto: "bg-zinc-800 text-zinc-300",
  calificado: "bg-blue-950 text-blue-300",
  propuesta: "bg-amber-950 text-amber-300",
  negociacion: "bg-purple-950 text-purple-300",
  cerrado_ganado: "bg-emerald-950 text-emerald-300",
  cerrado_perdido: "bg-red-950 text-red-300",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
