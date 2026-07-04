import Link from "next/link";
import { requirePartner } from "@/modules/auth/require-partner";

export default async function AcademiaPage() {
  await requirePartner();
  return (
    <main className="min-h-screen bg-[#08080a] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
          ← Resumen
        </Link>
        <h1 className="text-2xl font-semibold">Academia / Bot</h1>
        <p className="text-zinc-400">
          Biblioteca de sesiones y bot &quot;Mi Cabeza&quot; con RAG sobre las
          transcripciones. En construcción (Fase 6).
        </p>
      </div>
    </main>
  );
}
