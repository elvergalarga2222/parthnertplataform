"use client";

import { Trash2 } from "lucide-react";
import type { CrmSnapshot, CustomFieldView, DealView } from "@/modules/crm/types";
import {
  formatMoney,
  groupDealsByActivity,
} from "@/modules/crm/helpers";
import {
  deleteCustomFieldAction,
  setCustomFieldValueAction,
} from "@/modules/crm/actions";
import type { RunAction } from "./ClientesView";
import { STAGE_COLORS } from "./stage-colors";
import FitBadge from "./FitBadge";
import AddColumnButton from "./AddColumnButton";
import CustomFieldCell from "./CustomFieldCell";

export default function RecordsTable({
  data,
  runAction,
  onOpenDeal,
}: {
  data: CrmSnapshot;
  runAction: RunAction;
  onOpenDeal: (deal: DealView) => void;
}) {
  const groups = groupDealsByActivity(data.deals);
  const stageById = new Map(data.stages.map((s) => [s.id, s]));

  const handleSetValue = (field: CustomFieldView, deal: DealView, value: unknown) =>
    runAction(
      (d) => ({
        ...d,
        deals: d.deals.map((x) =>
          x.id === deal.id ? { ...x, custom: { ...x.custom, [field.id]: value } } : x,
        ),
      }),
      () =>
        setCustomFieldValueAction({
          fieldId: field.id,
          entityId: deal.id,
          value: value as string | number | boolean | null,
        }),
    );

  const handleDeleteField = (field: CustomFieldView) =>
    runAction(
      (d) => ({
        ...d,
        customFields: d.customFields.filter((f) => f.id !== field.id),
      }),
      () => deleteCustomFieldAction(field.id),
    );

  const colCount = 7 + data.customFields.length + 1;

  return (
    <div className="overflow-auto rounded-2xl border border-edge bg-surface">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-edge text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <th className="px-4 py-3">Deal</th>
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Etapa</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Fit</th>
            <th className="px-4 py-3">Próxima actividad</th>
            {data.customFields.map((field) => (
              <th key={field.id} className="group px-4 py-3">
                <span className="flex items-center gap-1.5">
                  {field.label}
                  <button
                    type="button"
                    aria-label={`Eliminar columna ${field.label}`}
                    onClick={() => handleDeleteField(field)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2
                      size={12}
                      className="text-ink-muted transition-colors hover:text-negative"
                    />
                  </button>
                </span>
              </th>
            ))}
            <th className="px-3 py-2">
              <AddColumnButton runAction={runAction} />
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows
              key={group.key}
              label={group.label}
              deals={group.deals}
              colCount={colCount}
              stageById={stageById}
              customFields={data.customFields}
              onOpenDeal={onOpenDeal}
              onSetValue={handleSetValue}
            />
          ))}
          {data.deals.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-10 text-center text-[13px] text-ink-muted"
              >
                Aún no hay deals. Crea el primero con «Nuevo deal».
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  label,
  deals,
  colCount,
  stageById,
  customFields,
  onOpenDeal,
  onSetValue,
}: {
  label: string;
  deals: DealView[];
  colCount: number;
  stageById: Map<string, CrmSnapshot["stages"][number]>;
  customFields: CustomFieldView[];
  onOpenDeal: (deal: DealView) => void;
  onSetValue: (field: CustomFieldView, deal: DealView, value: unknown) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          className="border-b border-edge bg-surface-2 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-primary-soft"
        >
          {label}
          <span className="ml-2 font-medium normal-case tracking-normal text-ink-muted">
            {deals.length} {deals.length === 1 ? "deal" : "deals"}
          </span>
        </td>
      </tr>
      {deals.map((deal) => {
        const stage = stageById.get(deal.stageId);
        const color = stage ? (STAGE_COLORS[stage.color] ?? STAGE_COLORS.gray) : null;
        return (
          <tr
            key={deal.id}
            className="border-b border-edge/60 text-[12.5px] transition-colors duration-100 last:border-0 hover:bg-surface-2/60"
          >
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => onOpenDeal(deal)}
                className="font-semibold text-ink transition-colors hover:text-primary-soft"
              >
                {deal.title}
              </button>
            </td>
            <td className="px-4 py-3 text-ink-secondary">
              {deal.companyName ?? "—"}
            </td>
            <td className="px-4 py-3 text-ink-secondary">
              {deal.contactName ?? "—"}
            </td>
            <td className="px-4 py-3">
              {stage && color ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color.dot }}
                  />
                  {stage.name}
                </span>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-3 text-right font-semibold text-primary-soft">
              {formatMoney(deal.value, deal.currency)}
            </td>
            <td className="px-4 py-3">
              <FitBadge fit={deal.fit} />
            </td>
            <td className="px-4 py-3 text-ink-secondary">
              {deal.nextActivity ? (
                <span className="block max-w-48 truncate">{deal.nextActivity}</span>
              ) : (
                "—"
              )}
              {deal.nextActivityAt && (
                <span className="block text-[10.5px] text-ink-muted">
                  {new Date(deal.nextActivityAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </td>
            {customFields.map((field) => (
              <td key={field.id} className="px-2 py-1.5">
                <CustomFieldCell
                  field={field}
                  value={deal.custom[field.id]}
                  onChange={(value) => onSetValue(field, deal, value)}
                />
              </td>
            ))}
            <td />
          </tr>
        );
      })}
    </>
  );
}
