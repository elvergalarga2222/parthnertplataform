"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Opportunity } from "@/modules/dashboard/dashboard-service";

const STAGE_COLOR: Record<string, string> = {
  Descubrimiento: "bg-sky-500/15 text-sky-300",
  Calificado: "bg-blue-500/15 text-blue-300",
  Propuesta: "bg-amber-500/15 text-amber-300",
  Negociación: "bg-violet-500/15 text-violet-300",
};

export function Opportunities({ items }: { items: Opportunity[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">
          Oportunidades clave recientes
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll(-1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            ‹
          </button>
          <button
            onClick={() => scroll(1)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((o) => (
          <Link
            key={o.id}
            href="/crm"
            className="group w-64 shrink-0 rounded-2xl border border-white/5 bg-gradient-to-b from-[#141418] to-[#0d0d11] p-4 transition hover:border-violet-500/30"
          >
            <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 via-violet-500/5 to-transparent text-3xl">
              <span className="opacity-40 transition group-hover:opacity-70">◈</span>
            </div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                STAGE_COLOR[o.stage] ?? "bg-zinc-700/40 text-zinc-300"
              }`}
            >
              {o.stage}
            </span>
            <p className="mt-2 truncate text-sm font-medium text-white">
              {o.businessName}
            </p>
            <p className="text-lg font-semibold text-white">
              €{o.amount.toLocaleString("es-ES")}
            </p>
            <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/20 text-[10px] text-violet-200">
                {o.owner.slice(0, 1)}
              </span>
              <span className="truncate text-xs text-zinc-400">{o.owner}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
