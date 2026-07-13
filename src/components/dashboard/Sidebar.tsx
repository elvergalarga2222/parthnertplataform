"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Briefcase,
  CheckSquare,
  Home,
  LogOut,
  Settings,
  Sparkles,
  Users,
  Users2,
  Workflow,
  LayoutGrid,
} from "lucide-react";
import type { TeamMember } from "@/modules/dashboard/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Resumen", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/espacios", label: "Espacios de Trabajo", icon: LayoutGrid },
  { href: "/partner-business", label: "Partner Business", icon: Briefcase },
  { href: "/equipo", label: "Equipo", icon: Users2 },
  { href: "/academia", label: "Academia / Bot", icon: Bot },
  { href: "/flujos", label: "Flujos & Procesos", icon: Workflow },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function Sidebar({
  team,
  logoutAction,
}: {
  team: TeamMember[];
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-edge bg-surface max-lg:hidden">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 pb-6 pt-6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow">
          <Sparkles size={16} className="text-white" strokeWidth={2.5} />
        </span>
        <span className="text-[15px] font-bold tracking-tight text-ink">
          Partner Manager
        </span>
      </Link>

      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-150 ${
                active
                  ? "bg-primary-faint text-primary-soft"
                  : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon
                size={17}
                strokeWidth={2}
                className={
                  active
                    ? "text-primary-soft"
                    : "text-ink-muted transition-colors group-hover:text-ink-secondary"
                }
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 px-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Team
        </p>
        {team.length === 0 ? (
          <Link
            href="/equipo"
            className="mt-3 block text-[12px] font-medium text-primary-soft hover:underline"
          >
            Invita a tu equipo
          </Link>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {team.map((member) => (
              <li key={member.name} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-primary-soft ring-1 ring-edge">
                  {initials(member.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-ink">
                    {member.name}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {member.role}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-edge px-3 py-4">
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          <Settings size={17} strokeWidth={2} className="text-ink-muted" />
          Configuración
        </button>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink-secondary transition-colors duration-150 hover:bg-negative/10 hover:text-negative"
          >
            <LogOut size={17} strokeWidth={2} className="text-ink-muted" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
