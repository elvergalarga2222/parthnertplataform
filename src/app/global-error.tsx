"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Última red de seguridad: captura errores del propio layout raíz, el caso que
// dejaba la pantalla completamente en blanco sin ninguna pista. Reemplaza todo
// el documento, así que trae su propio <html>/<body> y usa estilos inline
// (la hoja de estilos podría no haber cargado si el layout falló).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    reportClientError(error, "global-error");
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 32,
          textAlign: "center",
          background: "#0a0a0f",
          color: "#f4f4f6",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          La aplicación encontró un error
        </h1>
        <p style={{ maxWidth: 420, fontSize: 14, color: "#a3a3b2", margin: 0 }}>
          Ocurrió un fallo inesperado al cargar la aplicación. El detalle quedó
          registrado en el servidor.
        </p>
        {error.digest && (
          <code
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#a3a3b2",
              border: "1px solid #262633",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            digest: {error.digest}
          </code>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 12,
            background: "#8b7cf6",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 20px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
