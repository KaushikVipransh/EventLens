import cors from 'cors';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './http.js';
import { logger } from './logger.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { galleryRouter } from './routes/gallery.js';
import { healthRouter } from './routes/health.js';
import { shareRouter } from './routes/share.js';
import { uploadsRouter } from './routes/uploads.js';

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: config.WEB_BASE_URL, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use('/events', eventsRouter);
  app.use(uploadsRouter);
  app.use(galleryRouter);
  app.use(shareRouter);
  // Feature routers are mounted here in later phases.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
