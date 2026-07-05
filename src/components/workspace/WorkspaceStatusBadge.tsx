import type { WorkspaceStatus } from "@/modules/workspace/types";

const STATUS_STYLES: Record<WorkspaceStatus, string> = {
  activo: "bg-positive/15 text-positive",
  pausado: "bg-amber-400/15 text-amber-300",
  finalizado: "bg-surface-3 text-ink-secondary",
};

export default function WorkspaceStatusBadge({
  status,
}: {
  status: WorkspaceStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
