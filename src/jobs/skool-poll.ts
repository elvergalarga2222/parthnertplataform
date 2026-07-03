import { Queue, Worker } from "bullmq";
import { getRedis } from "@/lib/redis";
import { getAuthService } from "@/modules/auth";

// Red de seguridad de la revocación (Épica 1): reconcilia las membresías
// locales contra Skool cada 15 minutos por si un webhook se perdió.
const QUEUE_NAME = "skool-poll";
const POLL_INTERVAL_MS = 15 * 60 * 1000;

export async function startSkoolPollJob() {
  const connection = getRedis();

  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler("skool-poll-scheduler", {
    every: POLL_INTERVAL_MS,
  });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const revoked = await getAuthService().reconcile();
      if (revoked > 0) {
        console.log(`[skool-poll] revoked ${revoked} partner(s)`);
      }
    },
    { connection },
  );

  worker.on("failed", (_job, err) => {
    console.error("[skool-poll] job failed:", err.message);
  });

  return { queue, worker };
}
