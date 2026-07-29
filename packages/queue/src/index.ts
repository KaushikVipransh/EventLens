import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { REDIS_URL } from './env.js';

export const PHOTO_QUEUE = 'photo-processing';

/** Payload for a single photo's face-processing job. */
export interface PhotoJobData {
  photoId: string;
  eventId: string;
  storageKey: string;
  /** If set, the worker first downloads this Google Drive file into storageKey. */
  driveFileId?: string;
}

/**
 * A fresh Redis connection. BullMQ requires `maxRetriesPerRequest: null` for
 * blocking commands used by workers; producers can share the same setting.
 */
export function createRedisConnection(): Redis {
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

let photoQueue: Queue<PhotoJobData> | undefined;

/** Lazily-created singleton producer queue. */
export function getPhotoQueue(): Queue<PhotoJobData> {
  photoQueue ??= new Queue<PhotoJobData>(PHOTO_QUEUE, { connection: createRedisConnection() });
  return photoQueue;
}

export function enqueuePhotoJob(data: PhotoJobData): Promise<unknown> {
  return getPhotoQueue().add('process-photo', data, DEFAULT_JOB_OPTS);
}
