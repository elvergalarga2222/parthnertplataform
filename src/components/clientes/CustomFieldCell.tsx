"use client";

import { useState } from "react";
import type { CustomFieldView } from "@/modules/crm/types";

// Inline editable cell for a custom field value, rendered by type.
export default function CustomFieldCell({
  field,
  value,
  onChange,
}: {
  field: CustomFieldView;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    setEditing(false);
    const trimmed = raw.trim();
    if (field.fieldType === "number") {
      onChange(trimmed === "" ? null : Number(trimmed));
    } else {
      onChange(trimmed === "" ? null : trimmed);
    }
  };

  if (field.fieldType === "boolean") {
    return (
      <label className="flex cursor-pointer justify-center">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={field.label}
          className="h-4 w-4 accent-[#8b7cf6]"
        />
      </label>
    );
  }

  if (field.fieldType === "select") {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        aria-label={field.label}
        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[12px] text-ink-secondary outline-none transition-colors hover:border-edge focus:border-primary/60"
      >
        <option value="">—</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={
          field.fieldType === "number"
            ? "number"
            : field.fieldType === "date"
              ? "date"
              : "text"
        }
        defaultValue={draft}
        aria-label={field.label}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full rounded-lg border border-primary/60 bg-surface-2 px-2 py-1.5 text-[12px] text-ink outline-none"
      />
    );
  }

  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : field.fieldType === "date" && typeof value === "string"
        ? new Date(value).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : String(value);

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(typeof value === "string" || typeof value === "number" ? String(value) : "");
        setEditing(true);
      }}
      aria-label={`Editar ${field.label}`}
      className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-[12px] text-ink-secondary transition-colors hover:border-edge hover:text-ink"
    >
      {display}
    </button>
  );
}
