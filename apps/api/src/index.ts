import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { ensureBucket } from './storage.js';

async function main(): Promise<void> {
  await ensureBucket();
  const app = createApp();
  app.listen(config.API_PORT, () => {
    logger.info(`eventlens-api listening on http://localhost:${config.API_PORT}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start eventlens-api');
  process.exit(1);
});
