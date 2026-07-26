import { db, schema } from '@eventlens/db';
import { enqueuePhotoJob } from '@eventlens/queue';
import { presignRequestSchema, uploadCompleteSchema } from '@eventlens/shared';
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { requirePhotographer } from '../auth/middleware.js';
import { signPhotographerToken } from '../auth/tokens.js';
import { asyncHandler, notFound, parse } from '../http.js';
import { buildPhotoKey, presignPut } from '../storage.js';

export const uploadsRouter = Router();

const sessionSchema = z.object({ uploadToken: z.string().min(1).max(64) });

/**
 * Exchange an opaque photographer upload-link token for a scoped JWT the
 * upload page uses as a bearer token. Public (the link is the credential).
 */
uploadsRouter.post(
  '/uploads/session',
  asyncHandler(async (req, res) => {
    const { uploadToken } = parse(sessionSchema, req.body);
    const photographer = await db.query.photographers.findFirst({
      where: eq(schema.photographers.uploadToken, uploadToken),
    });
    if (!photographer) throw notFound('Upload link not found');

    const event = await db.query.events.findFirst({
      where: eq(schema.events.id, photographer.eventId),
      columns: { id: true, name: true, date: true },
    });
    if (!event) throw notFound('Event not found');

    // Albums the photographer can upload into.
    const albums = await db.query.albums.findMany({
      where: eq(schema.albums.eventId, event.id),
      columns: { id: true, name: true },
      orderBy: (a, { desc }) => desc(a.createdAt),
    });

    const token = signPhotographerToken(photographer.id, photographer.eventId);
    res.json({
      token,
      photographer: { id: photographer.id, name: photographer.name },
      event,
      albums,
    });
  }),
);

/** Return presigned PUT URLs for a batch of files (photographer-scoped). */
uploadsRouter.post(
  '/uploads/presign',
  requirePhotographer,
  asyncHandler(async (req, res) => {
    const { files } = parse(presignRequestSchema, req.body);
    const { eventId } = req.photographer!;

    const uploads = await Promise.all(
      files.map(async (file) => {
        const storageKey = buildPhotoKey(eventId, file.filename);
        const uploadUrl = await presignPut(storageKey, file.contentType);
        return { filename: file.filename, storageKey, uploadUrl };
      }),
    );

    res.json({ uploads });
  }),
);

/**
 * Register uploaded photos as `pending` rows. Each becomes a background
 * processing job (wired in task 5.3 once the queue package exists).
 */
uploadsRouter.post(
  '/uploads/complete',
  requirePhotographer,
  asyncHandler(async (req, res) => {
    const { photos, albumId } = parse(uploadCompleteSchema, req.body);
    const { photographerId, eventId } = req.photographer!;

    // If an album was chosen, ensure it belongs to this event before using it.
    let validAlbumId: string | null = null;
    if (albumId) {
      const album = await db.query.albums.findFirst({
        where: and(eq(schema.albums.id, albumId), eq(schema.albums.eventId, eventId)),
        columns: { id: true },
      });
      if (!album) throw notFound('Album not found for this event');
      validAlbumId = album.id;
    }

    const inserted = await db
      .insert(schema.photos)
      .values(
        photos.map((p) => ({
          eventId,
          photographerId,
          albumId: validAlbumId,
          storageKey: p.storageKey,
          filename: p.filename,
          contentType: p.contentType,
          size: p.size,
          status: 'pending' as const,
        })),
      )
      .returning({ id: schema.photos.id, storageKey: schema.photos.storageKey });

    // Fan out one background face-processing job per uploaded photo.
    await Promise.all(
      inserted.map((p) => enqueuePhotoJob({ photoId: p.id, eventId, storageKey: p.storageKey })),
    );

    res.status(201).json({ photos: inserted, queued: inserted.length });
  }),
);
