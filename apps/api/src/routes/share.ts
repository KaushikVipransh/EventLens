import { db, schema } from '@eventlens/db';
import archiver from 'archiver';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, notFound, parse } from '../http.js';
import { getObjectStream, presignGet } from '../storage.js';

export const shareRouter = Router();

/** Resolve a share token to its link, enforcing expiry. Public (token is the key). */
async function resolveShare(token: string) {
  const link = await db.query.shareLinks.findFirst({
    where: eq(schema.shareLinks.token, token),
  });
  if (!link) throw notFound('Share link not found');
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    throw notFound('This share link has expired');
  }
  return link;
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

/** Public metadata + paginated photos for a share link. */
shareRouter.get(
  '/share/:token',
  asyncHandler(async (req, res) => {
    const link = await resolveShare(String(req.params.token));
    const parsed = parse(listQuerySchema, req.query);
    const page = parsed.page ?? 1;
    const limit = parsed.limit ?? 40;

    const event = await db.query.events.findFirst({
      where: eq(schema.events.id, link.eventId),
      columns: { name: true },
    });
    const album = link.albumId
      ? await db.query.albums.findFirst({
          where: eq(schema.albums.id, link.albumId),
          columns: { name: true },
        })
      : null;

    const rows = await db.query.photos.findMany({
      where: and(
        eq(schema.photos.eventId, link.eventId),
        eq(schema.photos.status, 'processed'),
        link.albumId ? eq(schema.photos.albumId, link.albumId) : undefined,
      ),
      orderBy: desc(schema.photos.createdAt),
      limit,
      offset: (page - 1) * limit,
      columns: { id: true, filename: true, storageKey: true, thumbStorageKey: true },
    });

    const photos = await Promise.all(
      rows.map(async ({ storageKey, thumbStorageKey, ...p }) => ({
        ...p,
        url: await presignGet(thumbStorageKey ?? storageKey),
        fullUrl: await presignGet(storageKey),
      })),
    );

    res.json({
      event: { name: event?.name ?? 'Event' },
      album: album ? { name: album.name } : null,
      allowDownload: link.allowDownload,
      page,
      limit,
      photos,
    });
  }),
);

/** Photos that belong to a share link's scope (event, and album if scoped). */
async function scopedPhotos(link: { eventId: string; albumId: string | null }, ids: string[]) {
  const rows = await db.query.photos.findMany({
    where: and(
      eq(schema.photos.eventId, link.eventId),
      link.albumId ? eq(schema.photos.albumId, link.albumId) : undefined,
    ),
    columns: { id: true, filename: true, storageKey: true, contentType: true },
  });
  const allowed = new Set(ids);
  const found = rows.filter((r) => allowed.has(r.id));
  if (found.length !== ids.length) throw notFound('One or more photos not in this share link');
  return found;
}

shareRouter.get(
  '/share/:token/photos/:photoId/download',
  asyncHandler(async (req, res) => {
    const link = await resolveShare(String(req.params.token));
    if (!link.allowDownload) throw badRequest('Downloads are disabled for this link');
    const [photo] = await scopedPhotos(link, [String(req.params.photoId)]);
    res.setHeader('Content-Type', photo!.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${photo!.filename}"`);
    const stream = await getObjectStream(photo!.storageKey);
    stream.pipe(res);
  }),
);

const batchSchema = z.object({ photoIds: z.array(z.string().uuid()).min(1).max(500) });

shareRouter.post(
  '/share/:token/download-batch',
  asyncHandler(async (req, res) => {
    const link = await resolveShare(String(req.params.token));
    if (!link.allowDownload) throw badRequest('Downloads are disabled for this link');
    const { photoIds } = parse(batchSchema, req.body);
    const photos = await scopedPhotos(link, photoIds);

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
