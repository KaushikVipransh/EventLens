import { queryClient } from '@eventlens/db';
import { Router } from 'express';
import { asyncHandler } from '../http.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'eventlens-api', time: new Date().toISOString() });
});

healthRouter.get(
  '/health/db',
  asyncHandler(async (_req, res) => {
    const rows = await queryClient`select 1 as ok`;
    res.json({ status: 'ok', db: rows[0]?.ok === 1 ? 'up' : 'unknown' });
  }),
);
