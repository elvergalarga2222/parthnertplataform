import { listPartners } from "@/modules/admin/service";
import { isAdminEmail } from "@/modules/auth/admin";
import AdminPartnersTable from "@/components/admin/AdminPartnersTable";

export const metadata = { title: "Admin · Partners" };
export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  const partners = await listPartners();
  // El flag se calcula server-side; el cliente solo recibe el booleano por fila.
  const rows = partners.map((p) => ({ ...p, isAdmin: isAdminEmail(p.email) }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Partners</h1>
      </div>
      <AdminPartnersTable partners={rows} />
    </div>
  );
}
