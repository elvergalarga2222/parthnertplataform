import Link from "next/link";
import { requirePartner } from "@/modules/auth/require-partner";

export default async function FlujosPage() {
  await requirePartner();
  return (
    <main className="px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
          ← Resumen
        </Link>
        <h1 className="text-2xl font-semibold">Flujos &amp; Procesos</h1>
        <p className="text-zinc-400">
          Lienzo visual tipo Miro con plantillas estratégicas. En construcción
          (Fase 7).
        </p>
      </div>
    </main>
  );
}
