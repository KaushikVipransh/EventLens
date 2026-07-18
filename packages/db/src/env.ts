import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load the monorepo-root .env when present (scripts run from packages/db cwd).
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(here, '../../../.env'),
]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}

export const DATABASE_URL = process.env.DATABASE_URL;

export function requireDatabaseUrl(): string {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and start docker compose.');
  }
  return DATABASE_URL;
}
