"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Shared error UI used by every error boundary. On mount it reports the error
// to the server (/api/log) so nothing fails silently, and shows the digest so
// a user can quote it and we can grep the matching server stack.
export default function ErrorState({
  error,
  reset,
  boundary,
  title = "Algo salió mal",
  description = "Ocurrió un error al cargar esta vista. El detalle quedó registrado en el servidor.",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  boundary: string;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    console.error(`[${boundary}]`, error);
    reportClientError(error, boundary);
  }, [error, boundary]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-secondary">{description}</p>
        {error.digest && (
          <p className="rounded-lg border border-edge bg-surface px-3 py-2 font-mono text-xs text-ink-secondary">
            digest: {error.digest}
          </p>
        )}
      </div>
      {reset && (
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-soft"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
