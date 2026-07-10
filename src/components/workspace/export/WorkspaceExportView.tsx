"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { WorkspaceExport } from "@/modules/workspace/types";
import WorkspaceExportDoc from "./WorkspaceExportDoc";

// Vista de exportación: barra de controles (oculta al imprimir) + documento
// "hoja de papel". El PDF sale con el diálogo de impresión del navegador
// (Guardar como PDF) — decisión confirmada: sin dependencias de render.

export default function WorkspaceExportView({ data }: { data: WorkspaceExport }) {
  const [includePlan, setIncludePlan] = useState(true);
  const [includeAnnex, setIncludeAnnex] = useState(false);

  return (
    <div className="min-h-full bg-base print:bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 print:hidden">
        <Link
          href={`/espacios/${data.id}`}
          className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
        >
          <ArrowLeft size={14} /> Volver al espacio
        </Link>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-secondary">
          <input
            type="checkbox"
            checked={includePlan}
            onChange={(e) => setIncludePlan(e.target.checked)}
            className="accent-[#8b7cf6]"
          />
          Incluir plan de trabajo
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-secondary">
          <input
            type="checkbox"
            checked={includeAnnex}
            onChange={(e) => setIncludeAnnex(e.target.checked)}
            className="accent-[#8b7cf6]"
          />
          Incluir anexos IA
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-soft"
        >
          <Printer size={14} /> Descargar PDF
        </button>
      </div>

      <div className="px-4 pb-10 print:p-0">
        <WorkspaceExportDoc
          data={data}
          includePlan={includePlan}
          includeAnnex={includeAnnex}
        />
      </div>
    </div>
  );
}
