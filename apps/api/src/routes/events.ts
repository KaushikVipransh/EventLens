import { db, schema } from '@eventlens/db';
import { createAlbumSchema, createEventSchema, createPhotographerSchema } from '@eventlens/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireOrganizer } from '../auth/middleware.js';
import { asyncHandler, notFound, parse } from '../http.js';
import { makeAttendeeCode, makeUploadToken } from '../ids.js';
import { deleteObject, presignGet } from '../storage.js';

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

// ── Albums (per-event photo groupings) ────────────────────────────────────────
eventsRouter.post(
  '/:id/albums',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const input = parse(createAlbumSchema, req.body);
    const [album] = await db
      .insert(schema.albums)
      .values({ eventId: event.id, name: input.name })
      .returning();
    res.status(201).json({ album });
  }),
);

eventsRouter.get(
  '/:id/albums',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const albums = await db
      .select({
        id: schema.albums.id,
        name: schema.albums.name,
        createdAt: schema.albums.createdAt,
        photoCount: sql<number>`count(${schema.photos.id})::int`,
      })
      .from(schema.albums)
      .leftJoin(schema.photos, eq(schema.photos.albumId, schema.albums.id))
      .where(eq(schema.albums.eventId, event.id))
      .groupBy(schema.albums.id)
      .orderBy(desc(schema.albums.createdAt));
    res.json({ albums });
  }),
);

eventsRouter.delete(
  '/:id/albums/:albumId',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    // Photos keep existing; their album_id is set null by the FK (become ungrouped).
    await db
      .delete(schema.albums)
      .where(
        and(
          eq(schema.albums.id, String(req.params.albumId)),
          eq(schema.albums.eventId, event.id),
        ),
      );
    res.status(204).end();
  }),
);

// ── Photos (organizer view + management) ──────────────────────────────────────
const photosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  albumId: z.string().uuid().optional(),
});

eventsRouter.get(
  '/:id/photos',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const q = parse(photosQuerySchema, req.query);
    const page = q.page ?? 1;
    const limit = q.limit ?? 40;

    const rows = await db.query.photos.findMany({
      where: and(
        eq(schema.photos.eventId, event.id),
        q.albumId ? eq(schema.photos.albumId, q.albumId) : undefined,
      ),
      orderBy: desc(schema.photos.createdAt),
      limit,
      offset: (page - 1) * limit,
      columns: {
        id: true,
        filename: true,
        status: true,
        faceCount: true,
        albumId: true,
        storageKey: true,
        thumbStorageKey: true,
      },
    });

    const photos = await Promise.all(
      rows.map(async ({ storageKey, thumbStorageKey, ...p }) => ({
        ...p,
        url: await presignGet(thumbStorageKey ?? storageKey),
        fullUrl: await presignGet(storageKey),
      })),
    );
    res.json({ page, limit, photos });
  }),
);

eventsRouter.delete(
  '/:id/photos/:photoId',
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(req);
    const photo = await db.query.photos.findFirst({
      where: and(
        eq(schema.photos.id, String(req.params.photoId)),
        eq(schema.photos.eventId, event.id),
      ),
      columns: { id: true, storageKey: true, thumbStorageKey: true },
    });
    if (!photo) throw notFound('Photo not found');

    // Remove the row (faces cascade) then best-effort delete storage objects.
    await db.delete(schema.photos).where(eq(schema.photos.id, photo.id));
    await deleteObject(photo.storageKey);
    if (photo.thumbStorageKey) await deleteObject(photo.thumbStorageKey);
    res.status(204).end();
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
