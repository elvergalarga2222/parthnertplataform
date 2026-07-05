import { notFound, redirect } from "next/navigation";
import { getCurrentPartner } from "@/modules/auth/service";
import { WorkspaceError, getWorkspaceSnapshot } from "@/modules/workspace/service";
import type { WorkspaceSnapshot } from "@/modules/workspace/types";
import WorkspaceView from "@/components/workspace/WorkspaceView";

export const metadata = { title: "Espacio de trabajo · Partner Manager" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");

  const { id } = await params;
  let snapshot: WorkspaceSnapshot;
  try {
    snapshot = await getWorkspaceSnapshot(partner.id, id);
  } catch (err) {
    if (err instanceof WorkspaceError) notFound();
    throw err;
  }

  return <WorkspaceView snapshot={snapshot} />;
}
