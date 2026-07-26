import { db, queryClient, schema } from '@eventlens/db';
import { attendeeAccessSchema, detectEmbedResponseSchema } from '@eventlens/shared';
import archiver from 'archiver';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAttendee } from '../auth/middleware.js';
import { signAttendeeToken } from '../auth/tokens.js';
import { asyncHandler, badRequest, notFound, parse } from '../http.js';
import { getObjectStream, presignGet } from '../storage.js';

export const galleryRouter = Router();

/** Attendee enters an event code → receives a scoped access token. Public. */
galleryRouter.post(
  '/attendee/session',
  asyncHandler(async (req, res) => {
    const { code } = parse(attendeeAccessSchema, req.body);
    const event = await db.query.events.findFirst({
      where: eq(schema.events.attendeeCode, code.toUpperCase()),
      columns: { id: true, name: true, date: true },
    });
    if (!event) throw notFound('Event not found for that code');

    res.json({ token: signAttendeeToken(event.id), event });
  }),
);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  // Optional: restrict to one album; omitted = every photo in the event.
  albumId: z.string().uuid().optional(),
});

/** Albums for the token's event, each with its processed-photo count. */
galleryRouter.get(
  '/attendee/albums',
  requireAttendee,
  asyncHandler(async (req, res) => {
    const { eventId } = req.attendee!;
    const albums = await db
      .select({
        id: schema.albums.id,
        name: schema.albums.name,
        photoCount: sql<number>`(count(${schema.photos.id}) filter (where ${schema.photos.status} = 'processed'))::int`,
      })
      .from(schema.albums)
      .leftJoin(schema.photos, eq(schema.photos.albumId, schema.albums.id))
      .where(eq(schema.albums.eventId, eventId))
      .groupBy(schema.albums.id)
      .orderBy(desc(schema.albums.createdAt));
    res.json({ albums });
  }),
);

/** Paginated gallery of processed photos for the token's event. */
galleryRouter.get(
  '/attendee/photos',
  requireAttendee,
  asyncHandler(async (req, res) => {
    const parsed = parse(listQuerySchema, req.query);
    const page = parsed.page ?? 1;
    const limit = parsed.limit ?? 40;
    const { eventId } = req.attendee!;

    const rows = await db.query.photos.findMany({
      where: and(
        eq(schema.photos.eventId, eventId),
        eq(schema.photos.status, 'processed'),
        parsed.albumId ? eq(schema.photos.albumId, parsed.albumId) : undefined,
      ),
      orderBy: desc(schema.photos.createdAt),
      limit,
      offset: (page - 1) * limit,
      columns: {
        id: true,
        filename: true,
        faceCount: true,
        createdAt: true,
        storageKey: true,
        thumbStorageKey: true,
      },
    });

    const photos = await Promise.all(
      rows.map(async ({ storageKey, thumbStorageKey, ...p }) => ({
        ...p,
        // Small preview for the grid; full-res served to the lightbox on open.
        url: await presignGet(thumbStorageKey ?? storageKey),
        fullUrl: await presignGet(storageKey),
      })),
    );

    res.json({ page, limit, photos });
  }),
);

/**
 * "Find my photos": a selfie (raw image bytes) is embedded by the face service,
 * then matched against the event's face embeddings via pgvector cosine distance.
 */
galleryRouter.post(
  '/attendee/search',
  requireAttendee,
  express.raw({ type: '*/*', limit: '12mb' }),
  asyncHandler(async (req, res) => {
    const { eventId } = req.attendee!;
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Missing selfie image');

    const faceRes = await fetch(`${config.FACE_SERVICE_URL}/detect-embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body,
    });
    if (!faceRes.ok) throw badRequest(`Face service error (${faceRes.status})`);
    const { faces } = detectEmbedResponseSchema.parse(await faceRes.json());
    if (faces.length === 0) throw badRequest('No face detected in the selfie. Try again.');

    // Use the highest-confidence detected face.
    const best = faces.reduce((a, b) => (b.detScore > a.detScore ? b : a));
    const vectorLiteral = `[${best.embedding.join(',')}]`;

    // One row per matching photo, ranked by closest face.
    const rows = await queryClient<
      {
        id: string;
        filename: string;
        storage_key: string;
        thumb_storage_key: string | null;
        distance: number;
      }[]
    >`
      select p.id, p.filename, p.storage_key, p.thumb_storage_key,
             min(f.embedding <=> ${vectorLiteral}::vector) as distance
      from faces f
      join photos p on p.id = f.photo_id
      where f.event_id = ${eventId} and p.status = 'processed'
      group by p.id, p.filename, p.storage_key, p.thumb_storage_key
      having min(f.embedding <=> ${vectorLiteral}::vector) < ${config.FACE_MATCH_THRESHOLD}
      order by distance asc
      limit 300
    `;

    const matches = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        filename: r.filename,
        distance: Number(r.distance),
        url: await presignGet(r.thumb_storage_key ?? r.storage_key),
        fullUrl: await presignGet(r.storage_key),
      })),
    );

    res.json({ count: matches.length, matches });
  }),
);

/** Verify a set of photo IDs all belong to the attendee's event. */
async function ownedPhotos(eventId: string, ids: string[]) {
  const rows = await db.query.photos.findMany({
    where: and(eq(schema.photos.eventId, eventId), inArray(schema.photos.id, ids)),
    columns: { id: true, filename: true, storageKey: true, contentType: true },
  });
  if (rows.length !== ids.length) throw notFound('One or more photos not found in this event');
  return rows;
}

/** Stream a single photo as an attachment download. */
galleryRouter.get(
  '/attendee/photos/:photoId/download',
  requireAttendee,
  asyncHandler(async (req, res) => {
    const [photo] = await ownedPhotos(req.attendee!.eventId, [String(req.params.photoId)]);
    res.setHeader('Content-Type', photo!.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${photo!.filename}"`);
    const stream = await getObjectStream(photo!.storageKey);
    stream.pipe(res);
  }),
);

const batchSchema = z.object({ photoIds: z.array(z.string().uuid()).min(1).max(500) });

/** Stream a zip archive of the requested photos. */
galleryRouter.post(
  '/attendee/download-batch',
  requireAttendee,
  asyncHandler(async (req, res) => {
    const { photoIds } = parse(batchSchema, req.body);
    const photos = await ownedPhotos(req.attendee!.eventId, photoIds);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="eventlens-photos.zip"');

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => res.destroy(err));
    archive.pipe(res);

    for (const photo of photos) {
      const stream = await getObjectStream(photo.storageKey);
      archive.append(stream, { name: photo.filename });
    }
    await archive.finalize();
  }),
);
