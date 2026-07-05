"use client";

import ErrorState from "@/components/system/ErrorState";

// Error boundary del área autenticada. Cubre en cascada todos los módulos bajo
// (app) — un fallo al renderizar Clientes, Espacios, etc. se muestra aquí (el
// sidebar del layout se mantiene) y se reporta al servidor vía /api/log.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      boundary="app/error"
      title="No se pudo cargar este módulo"
      description="Ocurrió un error al renderizar la vista. El detalle quedó registrado en el servidor."
    />
  );
}
