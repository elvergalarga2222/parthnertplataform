"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import FeedbackModal from "./FeedbackModal";

// Solo se renderiza para testers — el gate ya ocurrió server-side en
// (app)/layout.tsx (isTester nunca se evalúa ni se serializa para partners
// normales, misma disciplina que la prop isAdmin de PR-7).
export default function FeedbackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const route = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar bug o sugerencia"
        title="Reportar bug o sugerencia"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-glow transition-transform duration-150 hover:scale-105 max-sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] print:hidden"
      >
        <MessageSquarePlus size={20} />
      </button>
      {open && <FeedbackModal route={route} onClose={() => setOpen(false)} />}
    </>
  );
}
