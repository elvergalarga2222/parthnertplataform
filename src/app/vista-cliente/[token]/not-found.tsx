// Copy del 404 de la vista de cliente. Deliberadamente idéntico para token
// inexistente, enlace desactivado y partner congelado: no se le confirma a
// quien prueba tokens que alguno haya sido válido.
export default function VistaClienteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4">
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
