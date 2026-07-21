import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

  // 404 real (no un 200 con mensaje) para "no existe", "desactivado" y
  // "partner congelado" por igual: el status no debe revelar que un token
  // llegó a ser válido, y un recurso inexistente no debe responder 200.
  // El copy vive en not-found.tsx de este segmento.
  if (!view) notFound();

  return <ClientViewBoard view={view} />;
}
