"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODULES = [
  { href: "/dashboard", label: "Resumen", icon: "◉" },
  { href: "/crm", label: "Clientes", icon: "◇" },
  { href: "/workspace", label: "Espacios de Trabajo", icon: "▤" },
  { href: "/finanzas", label: "Partner Business", icon: "◈" },
  { href: "/academia", label: "Academia / Bot", icon: "✦" },
  { href: "/flujos", label: "Flujos & Procesos", icon: "⤳" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[#0b0b0e] px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-bold text-white">
          P
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">
          Partner<span className="text-violet-400">Manager</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {MODULES.map((m) => {
          const active =
            m.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-violet-500/15 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <span
                className={`text-base ${active ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`}
              >
                {m.icon}
              </span>
              {m.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/5 pt-4">
        <Link
          href="/ia"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <span className="text-base text-zinc-500">⚙</span> Configuración IA
        </Link>
      </div>
    </aside>
  );
}
