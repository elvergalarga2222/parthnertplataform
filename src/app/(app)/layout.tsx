import { redirect } from "next/navigation";
import { logoutAction } from "@/modules/auth/actions";
import { getCurrentPartner } from "@/modules/auth/service";

// Gating server-side: toda ruta bajo (app) exige una sesión válida y un partner
// activo. Al leer la cookie de sesión, Next renderiza estas rutas de forma
// dinámica, así que la verificación corre en cada request (revocación instantánea).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getCurrentPartner();
  if (!partner) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-sm font-semibold text-black dark:text-zinc-50">
          Partner Manager
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {partner.displayName ?? partner.email}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
