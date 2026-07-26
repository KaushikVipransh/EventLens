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

interface Optimized {
  size: number;
  contentType: string;
  filename: string;
}

/**
 * Storage-saver: re-encode the stored photo to a capped JPEG (baking in EXIF
 * orientation) and overwrite the original object, discarding the camera-
 * original. Runs AFTER face detection so recognition still uses full-res input.
 * Returns the new metadata, or null if disabled / not worth replacing.
 */
async function compressOriginal(
  key: string,
  bytes: Buffer,
  filename: string,
): Promise<Optimized | null> {
  if (config.INGEST_MAX_EDGE <= 0) return null;

  const optimized = await sharp(bytes)
    .rotate()
    .resize(config.INGEST_MAX_EDGE, config.INGEST_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: config.INGEST_QUALITY, mozjpeg: true })
    .toBuffer();

  // Only replace if it actually saves space (already-small photos are left alone).
  if (optimized.length >= bytes.length) return null;

  await putObject(key, optimized, 'image/jpeg');
  const jpgName = filename.replace(/\.[^.]+$/, '') + '.jpg';
  return { size: optimized.length, contentType: 'image/jpeg', filename: jpgName };
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

  // Storage-saver: shrink the stored original now that recognition is done.
  const [row] = await db
    .select({ filename: schema.photos.filename })
    .from(schema.photos)
    .where(eq(schema.photos.id, data.photoId));
  const optimized = row ? await compressOriginal(data.storageKey, bytes, row.filename) : null;

  await db
    .update(schema.photos)
    .set({
      status: 'processed',
      faceCount: faces.length,
      thumbStorageKey,
      processedAt: new Date(),
      error: null,
      ...(optimized
        ? { size: optimized.size, contentType: optimized.contentType, filename: optimized.filename }
        : {}),
    })
    .where(eq(schema.photos.id, data.photoId));

  logger.info(
    { photoId: data.photoId, faces: faces.length, optimized: !!optimized },
    'photo processed',
  );
}
