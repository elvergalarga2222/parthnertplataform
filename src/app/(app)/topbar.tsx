import { LogoutButton } from "./logout-button";

export function Topbar({ label }: { label: string }) {
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <header className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
      <div className="relative max-w-md flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          ⌕
        </span>
        <input
          placeholder="Buscar clientes, oportunidades, tareas…"
          className="w-full rounded-xl border border-white/5 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-violet-500/40 focus:outline-none"
        />
      </div>
      <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 text-zinc-400 transition hover:bg-white/5 hover:text-white">
        ✉
      </button>
      <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/5 text-zinc-400 transition hover:bg-white/5 hover:text-white">
        ⃰
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400" />
      </button>
      <div className="flex items-center gap-2 pl-1">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden text-sm text-zinc-200 sm:block">{label}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
