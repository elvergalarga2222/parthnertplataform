import { logger } from "@/lib/logger";
import { createMembershipSyncWorker } from "./membership-sync.worker";
import { MEMBERSHIP_SYNC_QUEUE, createMembershipSyncQueue } from "./queues";

// Entrypoint del proceso de jobs (npm run jobs / PM2, separado de `next start`).
// Levanta los workers y asegura el job repetible de sincronización cada 6 h.
async function main() {
  const queue = createMembershipSyncQueue();

  await queue.upsertJobScheduler(
    "membership-sync-every-6h",
    { every: 6 * 60 * 60 * 1000 },
    {
      name: MEMBERSHIP_SYNC_QUEUE,
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    },
  );

  createMembershipSyncWorker();
  logger.info("jobs: workers up", { queues: [MEMBERSHIP_SYNC_QUEUE] });
}

main().catch((err) => {
  logger.error("jobs: fatal on boot", err);
  process.exit(1);
});
