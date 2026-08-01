import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
for (const p of [resolve(here, '../../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(p)) loadEnv({ path: p });
}

const envSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  FACE_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  // Storage-saver: after face processing, the stored photo is re-encoded to a
  // capped JPEG (discarding the camera-original) to save storage at scale.
  // Set INGEST_MAX_EDGE=0 to disable and keep originals untouched.
  INGEST_MAX_EDGE: z.coerce.number().int().min(0).default(2560),
  INGEST_QUALITY: z.coerce.number().int().min(1).max(100).default(82),
  // Google Drive API key — legacy small-folder import path.
  GOOGLE_API_KEY: z.string().optional(),
  // Google OAuth client — used to refresh access tokens for authed downloads.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid worker environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
