import Link from "next/link";
import { requirePartner } from "@/modules/auth/require-partner";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const partner = await requirePartner();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Hola, {partner.displayName ?? partner.email}
            </h1>
            <p className="text-sm text-zinc-400">
              Tu sistema operativo como Partner.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/crm"
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 transition hover:border-zinc-500"
          >
            <h2 className="font-medium">CRM</h2>
            <p className="text-sm text-zinc-400">Pipeline SOBA/NOVA</p>
            <span className="mt-2 inline-block rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
              Disponible
            </span>
          </Link>
          <Link
            href="/workspace"
            className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 transition hover:border-zinc-500"
          >
            <h2 className="font-medium">Workspace</h2>
            <p className="text-sm text-zinc-400">Kanban y SOPs por cliente</p>
            <span className="mt-2 inline-block rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
              Disponible
            </span>
          </Link>
          {[
            { title: "Finanzas", desc: "Regla 70/30 y cobros", phase: "Fase 4" },
            { title: "Estrategia", desc: "Guiones y copiloto", phase: "Fase 5" },
            { title: "Academia", desc: "Clases y bot Mi Cabeza", phase: "Fase 6" },
            { title: "Lienzo", desc: "Flujogramas y plantillas", phase: "Fase 7" },
          ].map((m) => (
            <div
              key={m.title}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <h2 className="font-medium">{m.title}</h2>
              <p className="text-sm text-zinc-400">{m.desc}</p>
              <span className="mt-2 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {m.phase} — próximamente
              </span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
