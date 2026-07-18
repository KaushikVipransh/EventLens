import { db, schema } from '@eventlens/db';
import { PHOTO_QUEUE, type PhotoJobData, createRedisConnection } from '@eventlens/queue';
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { config } from './config.js';
import { logger } from './logger.js';
import { processPhotoJob } from './process-photo.js';

const worker = new Worker<PhotoJobData>(
  PHOTO_QUEUE,
  async (job) => processPhotoJob(job.data),
  { connection: createRedisConnection(), concurrency: config.WORKER_CONCURRENCY },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, photoId: job.data.photoId }, 'photo processed');
});

worker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, photoId: job?.data.photoId, attempts: job?.attemptsMade, err: err.message },
    'photo job failed',
  );
  // Once all retry attempts are exhausted, mark the photo failed for visibility.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void db
      .update(schema.photos)
      .set({ status: 'failed', error: err.message.slice(0, 500) })
      .where(eq(schema.photos.id, job.data.photoId))
      .catch((e) => logger.error({ e }, 'failed to mark photo failed'));
  }
});

logger.info(`eventlens-worker started (concurrency ${config.WORKER_CONCURRENCY})`);

async function shutdown(): Promise<void> {
  logger.info('shutting down worker...');
  await worker.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
