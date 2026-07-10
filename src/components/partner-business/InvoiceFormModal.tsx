"use client";

import { useState } from "react";
import Modal from "@/components/system/Modal";
import {
  createInvoiceAction,
  updateInvoiceAction,
} from "@/modules/finance/actions";
import type { WorkspaceOption } from "@/modules/finance/snapshot";
import type {
  Currency,
  InvoiceKind,
  InvoiceStatus,
  InvoiceView,
} from "@/modules/finance/types";
import { CURRENCIES, INVOICE_KINDS, INVOICE_STATUSES } from "@/modules/finance/types";
import { KIND_LABELS, STATUS_LABELS, inputClass, labelClass } from "./labels";
import type { RunFinanceAction } from "./PartnerBusinessView";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function InvoiceFormModal({
  mode,
  invoice,
  defaultCurrency,
  workspaceOptions,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  invoice: InvoiceView | null;
  defaultCurrency: Currency;
  workspaceOptions: WorkspaceOption[];
  runAction: RunFinanceAction;
  onClose: () => void;
}) {
  const [clientName, setClientName] = useState(invoice?.clientName ?? "");
  const [description, setDescription] = useState(invoice?.description ?? "");
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "");
  const [currency, setCurrency] = useState<Currency>(
    invoice?.currency ?? defaultCurrency,
  );
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "pendiente");
  const [kind, setKind] = useState<InvoiceKind>(invoice?.kind ?? "proyecto");
  const [issuedAt, setIssuedAt] = useState(invoice?.issuedAt ?? todayIso());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [workspaceId, setWorkspaceId] = useState(invoice?.workspaceId ?? "");
  const [saving, setSaving] = useState(false);

  const isAutomatic = Boolean(invoice?.externalRef);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      clientName,
      description: description || null,
      amount: Number(amount || "0"),
      currency,
      status,
      kind,
      issuedAt,
      dueDate: dueDate || null,
      workspaceId: workspaceId || null,
    };
    const ok = await runAction(() =>
      mode === "create"
        ? createInvoiceAction(payload)
        : updateInvoiceAction({ invoiceId: invoice!.id, ...payload }),
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={mode === "create" ? "Nueva factura" : "Editar factura"}
      onClose={onClose}
      wide
    >
      {isAutomatic && (
        <p className="mb-4 rounded-xl bg-primary-faint px-3 py-2 text-[11.5px] font-medium text-primary-soft">
          Factura automática (n8n). Puedes editarla y marcarla pagada, pero no
          eliminarla.
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Cliente
            <input
              autoFocus
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Descripción
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Retainer mensual"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Monto
            <input
              type="number"
              required
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Moneda
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Tipo de ingreso
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as InvoiceKind)}
              className={inputClass}
            >
              {INVOICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className={inputClass}
            >
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Emitida
            <input
              type="date"
              required
              min="1970-01-01"
              max="2100-12-31"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Vence
            <input
              type="date"
              min="1970-01-01"
              max="2100-12-31"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Espacio de cliente (opcional)
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Sin espacio —</option>
              {workspaceOptions.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.clientName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft disabled:opacity-60"
        >
          {saving
            ? "Guardando…"
            : mode === "create"
              ? "Crear factura"
              : "Guardar cambios"}
        </button>
      </form>
    </Modal>
  );
}
