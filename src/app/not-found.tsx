import Link from "next/link";

// Página 404 con estilo del dashboard (para notFound() y rutas inexistentes),
// en vez del not-found por defecto de Next sin estilos.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base p-8 text-center text-ink">
      <p className="text-5xl font-bold tracking-tight text-primary-soft">404</p>
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">No encontramos esta página</h1>
        <p className="text-sm text-ink-secondary">
          El recurso no existe o no tienes acceso a él.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-soft"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
