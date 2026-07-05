"use client";

import { useEffect } from "react";

// Error boundary del área autenticada. Sin esto, cualquier fallo al renderizar
// un módulo (p. ej. Clientes) dejaba el <main> vacío sin pista alguna. Ahora el
// error se muestra en pantalla y se registra en el servidor; el `digest` permite
// localizar el stack real en los logs (pm2 logs / docker logs) en producción,
// donde Next oculta el mensaje original por seguridad.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          No se pudo cargar este módulo
        </h2>
        <p className="text-sm text-ink-secondary">
          Ocurrió un error al renderizar la vista. El detalle quedó registrado en
          el servidor.
        </p>
        {error.digest && (
          <p className="rounded-lg border border-edge bg-surface px-3 py-2 font-mono text-xs text-ink-secondary">
            digest: {error.digest}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-soft"
      >
        Reintentar
      </button>
    </div>
  );
}
