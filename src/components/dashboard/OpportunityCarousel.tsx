"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Opportunity } from "@/modules/dashboard/types";
import OpportunityCard from "./OpportunityCard";

export default function OpportunityCarousel({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scrollByCards = (dir: 1 | -1) => {
    scroller.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section aria-label="Recientes oportunidades clave">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-tight">
          Recientes Oportunidades Clave
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Anterior"
            disabled={!canPrev}
            onClick={() => scrollByCards(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-edge bg-surface text-ink-secondary transition-all duration-150 hover:border-primary/50 hover:text-primary-soft disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            disabled={!canNext}
            onClick={() => scrollByCards(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-all duration-150 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>
      <div
        ref={scroller}
        onScroll={updateArrows}
        className="flex snap-x gap-4 overflow-x-auto pb-2"
      >
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opp={opp} />
        ))}
      </div>
    </section>
  );
}
