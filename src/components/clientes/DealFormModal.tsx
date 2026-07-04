"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  FIT_LEVELS,
  type CrmSnapshot,
  type DealView,
  type FitLevel,
} from "@/modules/crm/types";
import {
  createDealAction,
  deleteDealAction,
  setCustomFieldValueAction,
  updateDealAction,
} from "@/modules/crm/actions";
import type { RunAction } from "./ClientesView";
import CustomFieldCell from "./CustomFieldCell";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass =
  "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

import Modal from "./Modal";

export default function DealFormModal({
  mode,
  deal,
  data,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  deal: DealView | null;
  data: CrmSnapshot;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(deal?.title ?? "");
  const [value, setValue] = useState(deal ? String(deal.value) : "");
  const [stageId, setStageId] = useState(
    deal?.stageId ?? data.stages[0]?.id ?? "",
  );
  const [companyId, setCompanyId] = useState(deal?.companyId ?? "");
  const [newCompany, setNewCompany] = useState("");
  const [contactId, setContactId] = useState(deal?.contactId ?? "");
  const [newContact, setNewContact] = useState("");
  const [fit, setFit] = useState<FitLevel | "">(deal?.fit ?? "");
  const [nextActivity, setNextActivity] = useState(deal?.nextActivity ?? "");
  const [nextActivityDate, setNextActivityDate] = useState(
    deal?.nextActivityAt ? deal.nextActivityAt.slice(0, 10) : "",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericValue = Number(value || "0");
    const activityAt = nextActivityDate
      ? new Date(`${nextActivityDate}T09:00:00`).toISOString()
      : null;

    if (mode === "create") {
      await runAction(
        (d) => d, // el deal real (con id) llega con el refresh
        () =>
          createDealAction({
            title,
            value: numericValue,
            stageId,
            companyId: companyId || null,
            newCompanyName: companyId ? null : newCompany || null,
            contactId: contactId || null,
            newContactName: contactId ? null : newContact || null,
            fit: fit || null,
            nextActivity: nextActivity || null,
            nextActivityAt: activityAt,
          }),
      );
    } else if (deal) {
      await runAction(
        (d) => ({
          ...d,
          deals: d.deals.map((x) =>
            x.id === deal.id
              ? {
                  ...x,
                  title,
                  value: numericValue,
                  fit: fit || null,
                  nextActivity: nextActivity || null,
                  nextActivityAt: activityAt,
                }
              : x,
          ),
        }),
        () =>
          updateDealAction({
            dealId: deal.id,
            title,
            value: numericValue,
            fit: fit || null,
            nextActivity: nextActivity || null,
            nextActivityAt: activityAt,
          }),
      );
    }
    onClose();
  };

  const removeDeal = async () => {
    if (!deal) return;
    if (!window.confirm(`¿Eliminar el deal «${deal.title}»?`)) return;
    await runAction(
      (d) => ({ ...d, deals: d.deals.filter((x) => x.id !== deal.id) }),
      () => deleteDealAction(deal.id),
    );
    onClose();
  };

  const setCustomValue = (fieldId: string, newValue: unknown) => {
    if (!deal) return;
    runAction(
      (d) => ({
        ...d,
        deals: d.deals.map((x) =>
          x.id === deal.id
            ? { ...x, custom: { ...x.custom, [fieldId]: newValue } }
            : x,
        ),
      }),
      () =>
        setCustomFieldValueAction({
          fieldId,
          entityId: deal.id,
          value: newValue as string | number | boolean | null,
        }),
    );
  };

  return (
    <Modal
      title={mode === "create" ? "Nuevo deal" : "Editar deal"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Título
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Consultoría 4 semanas"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Valor (€)
            <input
              type="number"
              min="0"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </label>

          {mode === "create" && (
            <label className={labelClass}>
              Etapa
              <select
                required
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className={inputClass}
              >
                {[...data.stages]
                  .sort((a, b) => a.position - b.position)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <label className={labelClass}>
            Fit
            <select
              value={fit}
              onChange={(e) => setFit(e.target.value as FitLevel | "")}
              className={inputClass}
            >
              <option value="">Sin definir</option>
              {FIT_LEVELS.map((level) => (
                <option key={level} value={level} className="capitalize">
                  {level}
                </option>
              ))}
            </select>
          </label>

          {mode === "create" && (
            <>
              <label className={labelClass}>
                Empresa
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Nueva o sin empresa —</option>
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!companyId && (
                  <input
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Nombre de la nueva empresa (opcional)"
                    className={inputClass}
                  />
                )}
              </label>
              <label className={labelClass}>
                Contacto
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Nuevo o sin contacto —</option>
                  {data.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                {!contactId && (
                  <input
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="Nombre del nuevo contacto (opcional)"
                    className={inputClass}
                  />
                )}
              </label>
            </>
          )}

          <label className={labelClass}>
            Próxima actividad
            <input
              value={nextActivity}
              onChange={(e) => setNextActivity(e.target.value)}
              placeholder="Ej: Llamada de seguimiento"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Fecha de la actividad
            <input
              type="date"
              value={nextActivityDate}
              onChange={(e) => setNextActivityDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {mode === "edit" && deal && data.customFields.length > 0 && (
          <fieldset className="rounded-xl border border-edge p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Campos personalizados
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.customFields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-ink-secondary">
                    {field.label}
                  </span>
                  <CustomFieldCell
                    field={field}
                    value={deal.custom[field.id]}
                    onChange={(v) => setCustomValue(field.id, v)}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={removeDeal}
              className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3.5 py-2.5 text-[12.5px] font-semibold text-negative transition-colors duration-150 hover:bg-negative/10"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
          <button
            type="submit"
            className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
          >
            {mode === "create" ? "Crear deal" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
