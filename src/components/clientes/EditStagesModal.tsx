"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Trophy } from "lucide-react";
import {
  STAGE_COLOR_NAMES,
  type StageColorName,
  type StageView,
} from "@/modules/crm/types";
import {
  createStageAction,
  deleteStageAction,
  reorderStagesAction,
  updateStageAction,
} from "@/modules/crm/actions";
import type { RunAction } from "./ClientesView";
import { STAGE_COLORS } from "./stage-colors";
import Modal from "@/components/system/Modal";

export default function EditStagesModal({
  stages,
  runAction,
  onClose,
}: {
  stages: StageView[];
  runAction: RunAction;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<StageColorName>("purple");

  const ordered = [...stages].sort((a, b) => a.position - b.position);

  const rename = (stage: StageView, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.name) return;
    runAction(
      (d) => ({
        ...d,
        stages: d.stages.map((s) => (s.id === stage.id ? { ...s, name: trimmed } : s)),
      }),
      () => updateStageAction({ stageId: stage.id, name: trimmed }),
    );
  };

  const recolor = (stage: StageView, color: StageColorName) =>
    runAction(
      (d) => ({
        ...d,
        stages: d.stages.map((s) => (s.id === stage.id ? { ...s, color } : s)),
      }),
      () => updateStageAction({ stageId: stage.id, color }),
    );

  const move = (index: number, dir: -1 | 1) => {
    const ids = ordered.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    runAction(
      (d) => ({
        ...d,
        stages: d.stages.map((s) => ({ ...s, position: ids.indexOf(s.id) })),
      }),
      () => reorderStagesAction(ids),
    );
  };

  const remove = (stage: StageView) => {
    if (
      !window.confirm(
        `¿Eliminar la etapa «${stage.name}»? Sus deals se moverán a la primera etapa restante.`,
      )
    ) {
      return;
    }
    const fallback = ordered.find((s) => s.id !== stage.id);
    runAction(
      (d) => ({
        ...d,
        stages: d.stages
          .filter((s) => s.id !== stage.id)
          .map((s, i) => ({ ...s, position: i })),
        deals: fallback
          ? d.deals.map((deal) =>
              deal.stageId === stage.id ? { ...deal, stageId: fallback.id } : deal,
            )
          : d.deals,
      }),
      () => deleteStageAction(stage.id),
    );
  };

  const addStage = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    runAction(
      (d) => d, // el id real llega con el refresh
      () => createStageAction({ name, color: newColor }),
    );
  };

  return (
    <Modal title="Etapas del pipeline" onClose={onClose} wide>
      <ul className="flex flex-col gap-2">
        {ordered.map((stage, index) => (
          <li
            key={stage.id}
            className="flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-3 py-2"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[stage.color].dot }}
            />
            <input
              defaultValue={stage.name}
              aria-label={`Nombre de la etapa ${stage.name}`}
              onBlur={(e) => rename(stage, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-ink outline-none transition-colors hover:border-edge focus:border-primary/60"
            />
            {stage.isWon && (
              <span
                title="Etapa de cierre ganado"
                className="flex items-center gap-1 rounded-full bg-positive/15 px-2 py-0.5 text-[10px] font-semibold text-positive"
              >
                <Trophy size={10} /> Ganado
              </span>
            )}
            <select
              value={stage.color}
              aria-label={`Color de la etapa ${stage.name}`}
              onChange={(e) => recolor(stage, e.target.value as StageColorName)}
              className="rounded-lg border border-edge bg-surface px-2 py-1.5 text-[12px] text-ink-secondary outline-none focus:border-primary/60"
            >
              {STAGE_COLOR_NAMES.map((color) => (
                <option key={color} value={color}>
                  {STAGE_COLORS[color].label}
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Subir etapa"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label="Bajar etapa"
                disabled={index === ordered.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                aria-label={`Eliminar etapa ${stage.name}`}
                onClick={() => remove(stage)}
                className="ml-1 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={addStage}
        className="mt-4 flex items-center gap-2 border-t border-edge pt-4"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva etapa…"
          aria-label="Nombre de la nueva etapa"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <select
          value={newColor}
          aria-label="Color de la nueva etapa"
          onChange={(e) => setNewColor(e.target.value as StageColorName)}
          className="rounded-xl border border-edge bg-surface-2 px-2 py-2 text-[12px] text-ink-secondary outline-none focus:border-primary/60"
        >
          {STAGE_COLOR_NAMES.map((color) => (
            <option key={color} value={color}>
              {STAGE_COLORS[color].label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
        >
          <Plus size={14} /> Añadir
        </button>
      </form>
    </Modal>
  );
}
