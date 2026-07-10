import { notFound, redirect } from "next/navigation";
import { getCurrentPartner } from "@/modules/auth/service";
import {
  WorkspaceError,
  getWorkspaceExportData,
} from "@/modules/workspace/service";
import type { WorkspaceExport } from "@/modules/workspace/types";
import WorkspaceExportView from "@/components/workspace/export/WorkspaceExportView";

export const metadata = { title: "Exportar ficha · Partner Manager" };
export const dynamic = "force-dynamic";

export default async function WorkspaceExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");

  const { id } = await params;
  let data: WorkspaceExport;
  try {
    data = await getWorkspaceExportData(partner.id, id);
  } catch (err) {
    if (err instanceof WorkspaceError) notFound();
    throw err;
  }

  return <WorkspaceExportView data={data} />;
}
