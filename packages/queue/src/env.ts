import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const p of [resolve(process.cwd(), '.env'), resolve(here, '../../../.env')]) {
  if (existsSync(p)) {
    config({ path: p });
    break;
  }
}

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
