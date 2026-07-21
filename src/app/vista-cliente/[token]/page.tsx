import type { Metadata } from "next";
import { getClientViewByToken } from "@/modules/workspace/service";
import ClientViewBoard from "@/components/workspace/ClientViewBoard";

// Ruta pública sin sesión (regla #7). Fuera de (app), así que no hereda el
// layout autenticado. `noindex` para que un enlace compartido por WhatsApp no
// acabe en un buscador.
export const metadata: Metadata = {
  title: "Avance del proyecto · Partner Manager",
  robots: { index: false, follow: false },
};

// Depende del token y del estado vivo del tablero — nunca cachear.
export const dynamic = "force-dynamic";

export default async function VistaClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getClientViewByToken(token);

  // Un solo mensaje para "no existe", "desactivado" y "partner congelado": no
  // se le confirma a quien prueba tokens que alguno haya sido válido.
  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base px-4">
        <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 text-center shadow-card">
          <h1 className="text-[16px] font-bold text-ink">Enlace no disponible</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            Este enlace no es válido o fue desactivado. Pídele uno nuevo a tu
            estratega.
          </p>
        </div>
      </div>
    );
  }

  return <ClientViewBoard view={view} />;
}
