import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentAdmin } from "@/modules/auth/admin";
import { logoutAction } from "@/modules/auth/actions";

// Panel del OPERADOR. Gate server-side en cada request; los no-admin van al
// dashboard normal (nunca a una página de error que confirme que /admin
// existe). Layout propio: aquí no se monta el Sidebar/Topbar de partner.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <header className="flex items-center gap-3 border-b border-negative/30 bg-negative/10 px-6 py-3">
        <ShieldAlert size={16} className="text-negative" />
        <span className="text-[13.5px] font-bold tracking-tight">
          Partner Manager — Admin
        </span>
        <span className="rounded-full bg-negative/15 px-2 py-0.5 text-[10.5px] font-semibold text-negative">
          zona de operador
        </span>
        <nav className="ml-6 flex items-center gap-1">
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Resumen
          </Link>
          <Link
            href="/admin/partners"
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Partners
          </Link>
          <Link
            href="/admin/logs"
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Logs
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-ink-muted">{admin.email}</span>
          <Link
            href="/dashboard"
            className="rounded-lg border border-edge px-3 py-1.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
          >
            Volver a la app
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
