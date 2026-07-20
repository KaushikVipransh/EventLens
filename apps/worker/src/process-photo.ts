import { db, schema } from '@eventlens/db';
import type { PhotoJobData } from '@eventlens/queue';
import { detectEmbedResponseSchema } from '@eventlens/shared';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { config } from './config.js';
import { logger } from './logger.js';
import { getObjectBytes, putObject } from './storage.js';

/** Resize an image to a small gallery preview and store it; returns the key. */
async function generateThumbnail(originalKey: string, bytes: Buffer): Promise<string> {
  const thumb = await sharp(bytes)
    .rotate() // respect EXIF orientation
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
  const thumbKey = `thumb/${originalKey}.jpg`;
  await putObject(thumbKey, thumb, 'image/jpeg');
  return thumbKey;
}

/**
 * Process a single uploaded photo: fetch bytes from storage → detect faces +
 * embeddings via the Python face service → persist faces and mark the photo
 * processed. Throws on transient failure so BullMQ retries; the worker's
 * `failed` handler marks the photo failed once attempts are exhausted.
 */
export async function processPhotoJob(data: PhotoJobData): Promise<void> {
  await db
    .update(schema.photos)
    .set({ status: 'processing' })
    .where(eq(schema.photos.id, data.photoId));

  const bytes = await getObjectBytes(data.storageKey);

  // Generate a lightweight gallery thumbnail so browsers never load full-res
  // originals in the grid (critical for large events / low-RAM clients).
  const thumbStorageKey = await generateThumbnail(data.storageKey, bytes);

  const res = await fetch(`${config.FACE_SERVICE_URL}/detect-embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`face service responded ${res.status}: ${await res.text()}`);
  }

  const { faces } = detectEmbedResponseSchema.parse(await res.json());

  // Idempotent re-processing: clear any prior faces for this photo first.
  await db.delete(schema.faces).where(eq(schema.faces.photoId, data.photoId));
  if (faces.length > 0) {
    await db.insert(schema.faces).values(
      faces.map((f) => ({
        photoId: data.photoId,
        eventId: data.eventId,
        bbox: f.bbox,
        detScore: f.detScore,
        embedding: f.embedding,
      })),
    );
  }

  await db
    .update(schema.photos)
    .set({
      status: 'processed',
      faceCount: faces.length,
      thumbStorageKey,
      processedAt: new Date(),
      error: null,
    })
    .where(eq(schema.photos.id, data.photoId));

  logger.info({ photoId: data.photoId, faces: faces.length }, 'photo processed');
}
