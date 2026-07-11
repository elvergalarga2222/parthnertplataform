import type { MembershipAlert } from "@/modules/auth/service";

// Banner persistente (no solo dropdown): perder el acceso al panel es más
// grave que una factura por cobrar, así que va siempre visible bajo el
// topbar mientras falten ≤15 días de membresía.
export default function MembershipAlertBanner({
  alert,
}: {
  alert: MembershipAlert;
}) {
  // Componente de servidor (sin "use client"): puede leer la env directamente,
  // sin prefijo NEXT_PUBLIC_.
  const groupUrl = process.env.SKOOL_GROUP_URL;
  const days = alert.daysLeft;
  const label =
    days === 0
      ? "Tu membresía de Skool vence hoy."
      : days === 1
        ? "Tu membresía de Skool vence mañana."
        : `Tu membresía de Skool vence en ${days} días.`;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-6 py-2 text-[12.5px] text-amber-300"
    >
      <span className="font-semibold">{label}</span>
      <span>
        Renueva para no perder el acceso a tu panel — tus datos se conservan.
      </span>
      {groupUrl && (
        <a
          href={groupUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-lg border border-amber-400/40 px-3 py-1 text-[11.5px] font-semibold text-amber-300 transition-colors hover:bg-amber-400/15"
        >
          Ir al grupo de Skool
        </a>
      )}
    </div>
  );
}
