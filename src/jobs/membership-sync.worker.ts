import { Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { syncMemberships } from "@/modules/auth/membership-sync";
import { MEMBERSHIP_SYNC_QUEUE, createJobsConnection } from "./queues";

// Worker del sync de membresías. La lógica vive en
// auth/membership-sync.syncMemberships (testeable sin BullMQ); aquí solo se
// invoca. En fallo, BullMQ reintenta (attempts/backoff los fija el job
// repetible en index.ts) — y syncMemberships jamás congela por errores de red.
export function createMembershipSyncWorker(): Worker {
  const worker = new Worker(
    MEMBERSHIP_SYNC_QUEUE,
    async () => {
      const result = await syncMemberships();
      return result;
    },
    { connection: createJobsConnection() },
  );

  worker.on("completed", (job, result) => {
    logger.info("membership-sync job completed", { jobId: job.id, ...result });
  });
  worker.on("failed", (job, err) => {
    logger.error("membership-sync job failed", err, { jobId: job?.id });
  });
  return worker;
}
