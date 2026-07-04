"use client";

import { Bell, Mail, Search } from "lucide-react";

export default function Topbar({ displayName }: { displayName: string }) {
  return (
    <header className="flex items-center gap-4 px-6 pb-2 pt-5 max-md:flex-wrap">
      <label className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          placeholder="Buscar clientes, oportunidades, tareas…"
          className="w-full rounded-full border border-edge bg-surface py-2.5 pl-11 pr-4 text-[13px] text-ink placeholder:text-ink-muted outline-none transition-all duration-150 focus:border-primary/60 focus:shadow-glow"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Mensajes"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-ink-secondary transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft"
        >
          <Mail size={16} />
        </button>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-ink-secondary transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft"
        >
          <Bell size={16} />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-[12px] font-bold text-white">
          {displayName[0]?.toUpperCase() ?? "·"}
        </span>
        <span className="text-[13.5px] font-semibold text-ink max-sm:hidden">
          {displayName}
        </span>
      </div>
    </header>
  );
}
