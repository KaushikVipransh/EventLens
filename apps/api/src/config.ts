import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load monorepo-root .env (api runs with apps/api as cwd in dev).
const here = dirname(fileURLToPath(import.meta.url));
for (const p of [resolve(here, '../../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(p)) loadEnv({ path: p });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_BASE_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().url(),

  JWT_SECRET: z.string().min(1),
  ATTENDEE_TOKEN_TTL: z.coerce.number().int().positive().default(86400),
  PHOTOGRAPHER_TOKEN_TTL: z.coerce.number().int().positive().default(604800),

  FACE_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  FACE_MATCH_THRESHOLD: z.coerce.number().default(0.42),

  // Google Drive API key (Drive API enabled) — enables "import from Drive link".
  // Optional: the feature returns a clear error if it's not configured.
  GOOGLE_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;
