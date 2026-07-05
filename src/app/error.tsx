"use client";

import ErrorState from "@/components/system/ErrorState";

// Error boundary a nivel raíz: cubre rutas fuera de (app) — p. ej. /login — que
// no están bajo el boundary del área autenticada.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} boundary="root/error" />;
}
