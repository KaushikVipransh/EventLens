import { db, schema } from '@eventlens/db';
import { createEventSchema, createPhotographerSchema } from '@eventlens/shared';
import { and, desc, eq } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { config } from '../config.js';
import { requireOrganizer } from '../auth/middleware.js';
import { asyncHandler, notFound, parse } from '../http.js';
import { makeAttendeeCode, makeUploadToken } from '../ids.js';

export const eventsRouter = Router();

// All event-management routes require an organizer account.
eventsRouter.use(requireOrganizer);

/** Fetch an event owned by the requesting organizer, or throw 404. */
async function getOwnedEvent(req: Request) {
  const event = await db.query.events.findFirst({
    where: and(
      eq(schema.events.id, String(req.params.id)),
      eq(schema.events.organizerId, req.organizer!.organizerId),
    ),
  });
  if (!event) throw notFound('Event not found');
  return event;
}

function uploadLink(uploadToken: string): string {
  return `${config.WEB_BASE_URL}/upload/${uploadToken}`;
}

eventsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = parse(createEventSchema, req.body);
    const [event] = await db
      .insert(schema.events)
      .values({
        organizerId: req.organizer!.organizerId,
        name: input.name,
        date: input.date ?? null,
        attendeeCode: makeAttendeeCode(),
      })
      .returning();
    res.status(201).json({ event });
  }),
);

eventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db.query.events.findMany({
      where: eq(schema.events.organizerId, req.organizer!.organizerId),
      orderBy: desc(schema.events.createdAt),
    });
    res.json({ events: rows });
  }),
);

eventsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    res.json({ event });
  }),
);

// ── Photographers (per-event upload links) ────────────────────────────────────
eventsRouter.post(
  '/:id/photographers',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const input = parse(createPhotographerSchema, req.body);
    const [photographer] = await db
      .insert(schema.photographers)
      .values({ eventId: event.id, name: input.name, uploadToken: makeUploadToken() })
      .returning();
    res.status(201).json({
      photographer,
      uploadLink: uploadLink(photographer!.uploadToken),
    });
  }),
);

eventsRouter.get(
  '/:id/photographers',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const rows = await db.query.photographers.findMany({
      where: eq(schema.photographers.eventId, event.id),
      orderBy: desc(schema.photographers.createdAt),
    });
    res.json({
      photographers: rows.map((p) => ({ ...p, uploadLink: uploadLink(p.uploadToken) })),
    });
  }),
);

// ── Attendee access link ──────────────────────────────────────────────────────
eventsRouter.get(
  '/:id/attendee-link',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    res.json({
      code: event.attendeeCode,
      attendeeLink: `${config.WEB_BASE_URL}/e/${event.attendeeCode}`,
    });
  }),
);
