import { Queue, Worker } from "bullmq";
import { getDb } from "@/db";
import { getRedis } from "@/lib/redis";
import { FinanceService } from "@/modules/finance/finance-service";

// Job diario: marca como vencidas las cuentas por cobrar pendientes cuya
// fecha ya pasó (Épica 5: alertas de vencimiento).
const QUEUE_NAME = "receivables-due";

export async function startReceivablesDueJob() {
  const connection = getRedis();

  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler("receivables-due-scheduler", {
    pattern: "0 6 * * *", // 06:00 UTC diario
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const today = new Date().toISOString().slice(0, 10);
      const overdue = await new FinanceService(getDb()).markOverdue(today);
      if (overdue.length > 0) {
        console.log(`[receivables-due] marked ${overdue.length} overdue`);
      }
    },
    { connection },
  );

  worker.on("failed", (_job, err) => {
    console.error("[receivables-due] job failed:", err.message);
  });

  return { queue, worker };
}
