import { redirect } from "next/navigation";
import { getCurrentPartner } from "@/modules/auth/service";
import { getPartnerBusinessSnapshot } from "@/modules/finance/snapshot";
import PartnerBusinessView from "@/components/partner-business/PartnerBusinessView";

export const metadata = { title: "Partner Business · Partner Manager" };

// Datos por partner y por sesión: nunca servir una versión cacheada.
export const dynamic = "force-dynamic";

export default async function PartnerBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string; month?: string }>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");

  const { currency, month } = await searchParams;
  const snapshot = await getPartnerBusinessSnapshot(partner, { currency, month });

  return <PartnerBusinessView snapshot={snapshot} />;
}
