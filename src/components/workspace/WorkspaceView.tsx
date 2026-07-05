"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Columns3, Plus, Sparkles } from "lucide-react";
import type {
  WorkspaceCardView,
  WorkspaceSnapshot,
  WorkspaceStatus,
} from "@/modules/workspace/types";
import {
  moveCardAction,
  updateWorkspaceStatusAction,
  type ActionResult,
} from "@/modules/workspace/actions";
import { WORKSPACE_STATUSES } from "@/modules/workspace/types";
import WorkspaceKanban from "./WorkspaceKanban";
import WorkspaceProfileForm from "./WorkspaceProfileForm";
import ColumnsModal from "./ColumnsModal";
import CardFormModal from "./CardFormModal";
import SopPanel from "./SopPanel";

type Tab = "kanban" | "ficha" | "ia";

export type RunAction = (
  optimistic: (d: WorkspaceSnapshot) => WorkspaceSnapshot,
  action: () => Promise<ActionResult>,
) => Promise<void>;

// Optimistic mirror of service.moveCard for instant drag feedback.
function applyMoveLocally(
  cards: WorkspaceCardView[],
  cardId: string,
  columnId: string,
  index: number,
): WorkspaceCardView[] {
  const moving = cards.find((c) => c.id === cardId);
  if (!moving) return cards;
  const source = moving.columnId;

  const byColumn = (id: string) =>
    cards
      .filter((c) => c.columnId === id && c.id !== cardId)
      .sort((a, b) => a.position - b.position);

  const target = byColumn(columnId);
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, { ...moving, columnId });

  const updated = new Map<string, WorkspaceCardView>();
  target.forEach((c, i) => updated.set(c.id, { ...c, position: i }));
  if (source !== columnId) {
    byColumn(source).forEach((c, i) => updated.set(c.id, { ...c, position: i }));
  }
  return cards.map((c) => updated.get(c.id) ?? c);
}

export default function WorkspaceView({
  snapshot,
}: {
  snapshot: WorkspaceSnapshot;
}) {
  const router = useRouter();
  const [data, setData] = useState(snapshot);
  const [tab, setTab] = useState<Tab>("kanban");
  const [error, setError] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    snapshot.columns[0]?.id ?? null,
  );
  const [showColumns, setShowColumns] = useState(false);
  const [cardModal, setCardModal] = useState<
    { mode: "create" } | { mode: "edit"; card: WorkspaceCardView } | null
  >(null);

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

  const runAction: RunAction = async (optimistic, action) => {
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

  const handleMoveCard = (cardId: string, columnId: string, index: number) =>
    runAction(
      (d) => ({ ...d, cards: applyMoveLocally(d.cards, cardId, columnId, index) }),
      () => moveCardAction({ cardId, columnId, position: index }),
    );

  const changeStatus = (status: WorkspaceStatus) =>
    runAction(
      (d) => ({ ...d, status }),
      () => updateWorkspaceStatusAction({ workspaceId: data.id, status }),
    );

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
      active
        ? "bg-primary-faint text-primary-soft"
        : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
    }`;

  const selectedColumn =
    data.columns.find((c) => c.id === selectedColumnId) ?? null;

  return (
    <div className="flex h-full flex-col p-6 pt-4">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href="/espacios"
          aria-label="Volver a espacios"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-edge bg-surface text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
        >
          <ArrowLeft size={15} />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{data.clientName}</h1>
        <select
          value={data.status}
          onChange={(e) => changeStatus(e.target.value as WorkspaceStatus)}
          aria-label="Estado del espacio"
          className="rounded-full border border-edge bg-surface px-3 py-1.5 text-[11.5px] font-semibold capitalize text-ink-secondary outline-none transition-colors focus:border-primary/60"
        >
          {WORKSPACE_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-xl border border-edge bg-surface p-1">
          <button type="button" className={tabClass(tab === "kanban")} onClick={() => setTab("kanban")}>
            Kanban
          </button>
          <button type="button" className={tabClass(tab === "ficha")} onClick={() => setTab("ficha")}>
            Ficha
          </button>
          <button type="button" className={tabClass(tab === "ia")} onClick={() => setTab("ia")}>
            IA
          </button>
        </div>

        {tab === "kanban" && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowColumns(true)}
              className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft"
            >
              <Columns3 size={14} /> Columnas
            </button>
            <button
              type="button"
              onClick={() => setCardModal({ mode: "create" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
            >
              <Plus size={14} /> Nueva tarjeta
            </button>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {tab === "kanban" && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1">
              <WorkspaceKanban
                data={data}
                selectedColumnId={selectedColumnId}
                onSelectColumn={setSelectedColumnId}
                onMoveCard={handleMoveCard}
                onOpenCard={(card) => setCardModal({ mode: "edit", card })}
              />
            </div>
            <SopPanel column={selectedColumn} runAction={runAction} />
          </div>
        )}

        {tab === "ficha" && (
          <WorkspaceProfileForm
            workspaceId={data.id}
            profile={data.profile}
            runAction={runAction}
          />
        )}

        {tab === "ia" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-edge bg-surface p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faint text-primary-soft">
              <Sparkles size={24} />
            </span>
            <p className="text-[15px] font-semibold">Sub-módulos de IA</p>
            <p className="max-w-md text-[13px] leading-relaxed text-ink-secondary">
              Guiones, estrategia, diagnóstico e imágenes con IA llegan en el
              siguiente PR (módulo IA del workspace), con control de consumo
              por partner.
            </p>
            <span className="rounded-full border border-edge bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Próximamente
            </span>
          </div>
        )}
      </div>

      {showColumns && (
        <ColumnsModal
          workspaceId={data.id}
          columns={data.columns}
          runAction={runAction}
          onClose={() => setShowColumns(false)}
        />
      )}
      {cardModal && (
        <CardFormModal
          mode={cardModal.mode}
          card={cardModal.mode === "edit" ? cardModal.card : null}
          workspaceId={data.id}
          columns={data.columns}
          defaultColumnId={selectedColumnId}
          runAction={runAction}
          onClose={() => setCardModal(null)}
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
