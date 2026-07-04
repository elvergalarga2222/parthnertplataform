import { Construction } from "lucide-react";
import Link from "next/link";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-faint text-primary-soft">
        <Construction size={28} />
      </span>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-md text-[13.5px] leading-relaxed text-ink-secondary">
        {description}
      </p>
      <span className="rounded-full border border-edge bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
        Próximamente
      </span>
      <Link
        href="/dashboard"
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
      >
        Volver al Resumen
      </Link>
    </div>
  );
}
