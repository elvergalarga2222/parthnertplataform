import { listFeedbackReports } from "@/modules/admin/service";
import AdminFeedbackView from "@/components/admin/AdminFeedbackView";

export const metadata = { title: "Admin · Feedback" };
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const reports = await listFeedbackReports();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-lg font-bold tracking-tight">Feedback de testers</h1>
      <AdminFeedbackView reports={reports} />
    </div>
  );
}
