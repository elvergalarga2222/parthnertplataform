"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, Plus, Settings2, Table2 } from "lucide-react";
import type { CrmSnapshot, DealView } from "@/modules/crm/types";
import { applyMoveLocally } from "@/modules/crm/helpers";
import { moveDealAction, type ActionResult } from "@/modules/crm/actions";
import RecordsTable from "./RecordsTable";
import PipelineBoard from "./PipelineBoard";
import EditStagesModal from "./EditStagesModal";
import DealFormModal from "./DealFormModal";

type ViewMode = "tabla" | "pipeline";

export default function ClientesView({ snapshot }: { snapshot: CrmSnapshot }) {
  const router = useRouter();
  const [data, setData] = useState(snapshot);
  const [view, setView] = useState<ViewMode>("pipeline");
  const [error, setError] = useState<string | null>(null);
  const [showStages, setShowStages] = useState(false);
  const [dealModal, setDealModal] = useState<
    { mode: "create" } | { mode: "edit"; deal: DealView } | null
  >(null);

  // Adopta el snapshot fresco del servidor (tras router.refresh) durante el
  // render — patrón recomendado en vez de setState dentro de un effect.
  const [prevSnapshot, setPrevSnapshot] = useState(snapshot);
  if (snapshot !== prevSnapshot) {
    setPrevSnapshot(snapshot);
    setData(snapshot);
  }

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  // Optimistic runner: applies the local change, calls the server action and
  // reverts (plus toast) if it fails; on success re-syncs from the server.
  const runAction = async (
    optimistic: (d: CrmSnapshot) => CrmSnapshot,
    action: () => Promise<ActionResult>,
  ) => {
    const previous = data;
    setData(optimistic(previous));
    const result = await action();
    if (!result.ok) {
      setData(previous);
      setError(result.error);
    } else {
      router.refresh();
    }
  };

  const handleMoveDeal = (dealId: string, stageId: string, index: number) =>
    runAction(
      (d) => ({ ...d, deals: applyMoveLocally(d.deals, dealId, stageId, index) }),
      () => moveDealAction({ dealId, stageId, position: index }),
    );

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
      active
        ? "bg-primary-faint text-primary-soft"
        : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <div className="flex h-full flex-col p-6 pt-4">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <div className="flex items-center gap-1 rounded-xl border border-edge bg-surface p-1">
          <button
            type="button"
            className={tabClass(view === "pipeline")}
            onClick={() => setView("pipeline")}
          >
            <Kanban size={14} /> Pipeline
          </button>
          <button
            type="button"
            className={tabClass(view === "tabla")}
            onClick={() => setView("tabla")}
          >
            <Table2 size={14} /> Registros
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStages(true)}
            className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft"
          >
            <Settings2 size={14} /> Etapas
          </button>
          <button
            type="button"
            onClick={() => setDealModal({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
          >
            <Plus size={14} /> Nuevo deal
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view === "pipeline" ? (
          <PipelineBoard
            data={data}
            onMoveDeal={handleMoveDeal}
            onOpenDeal={(deal) => setDealModal({ mode: "edit", deal })}
          />
        ) : (
          <RecordsTable
            data={data}
            runAction={runAction}
            onOpenDeal={(deal) => setDealModal({ mode: "edit", deal })}
          />
        )}
      </div>

      {showStages && (
        <EditStagesModal
          stages={data.stages}
          runAction={runAction}
          onClose={() => setShowStages(false)}
        />
      )}
      {dealModal && (
        <DealFormModal
          mode={dealModal.mode}
          deal={dealModal.mode === "edit" ? dealModal.deal : null}
          data={data}
          runAction={runAction}
          onClose={() => setDealModal(null)}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-negative/40 bg-surface-3 px-4 py-2.5 text-[13px] font-medium text-negative shadow-card-hover"
        >
          {error}
        </div>
      )}
    </div>
  );
}

export type RunAction = (
  optimistic: (d: CrmSnapshot) => CrmSnapshot,
  action: () => Promise<ActionResult>,
) => Promise<void>;
