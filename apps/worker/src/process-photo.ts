import { db, schema } from '@eventlens/db';
import type { PhotoJobData } from '@eventlens/queue';
import { detectEmbedResponseSchema, isVideoType, type DetectedFace } from '@eventlens/shared';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { config } from './config.js';
import { logger } from './logger.js';
import { getObjectBytes, putObject } from './storage.js';
import { extractFrames } from './video.js';

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

/** Download a Google Drive file's bytes (public/shared) via the Drive API. */
async function downloadDriveFile(fileId: string): Promise<Buffer> {
  if (!config.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not set; cannot download Drive file');
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&key=${config.GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Drive download failed for ${fileId}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Detect faces + embeddings in a single image buffer via the face service. */
async function detectFaces(bytes: Buffer): Promise<DetectedFace[]> {
  const res = await fetch(`${config.FACE_SERVICE_URL}/detect-embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`face service responded ${res.status}: ${await res.text()}`);
  }
  const { faces } = detectEmbedResponseSchema.parse(await res.json());
  return faces;
}

/** Persist a photo/video's detected faces (idempotent: clears prior faces). */
async function saveFaces(photoId: string, eventId: string, faces: DetectedFace[]): Promise<void> {
  await db.delete(schema.faces).where(eq(schema.faces.photoId, photoId));
  if (faces.length > 0) {
    await db.insert(schema.faces).values(
      faces.map((f) => ({
        photoId,
        eventId,
        bbox: f.bbox,
        detScore: f.detScore,
        embedding: f.embedding,
      })),
    );
  }
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

  const [row] = await db
    .select({ filename: schema.photos.filename, contentType: schema.photos.contentType })
    .from(schema.photos)
    .where(eq(schema.photos.id, data.photoId));

  // "Import from Google Drive": pull the source file into our storage first.
  let bytes: Buffer;
  if (data.driveFileId) {
    bytes = await downloadDriveFile(data.driveFileId);
    await putObject(data.storageKey, bytes, row?.contentType ?? 'image/jpeg');
  } else {
    bytes = await getObjectBytes(data.storageKey);
  }

  if (row && isVideoType(row.contentType)) {
    await processVideo(data, bytes);
    return;
  }

  // ── Photo path ──────────────────────────────────────────────────────────────
  // Lightweight gallery thumbnail so browsers never load full-res in the grid.
  const thumbStorageKey = await generateThumbnail(data.storageKey, bytes);
  const faces = await detectFaces(bytes);
  await saveFaces(data.photoId, data.eventId, faces);

  // Storage-saver: shrink the stored original now that recognition is done.
  const optimized = row ? await compressOriginal(data.storageKey, bytes, row.filename) : null;

  await db
    .update(schema.photos)
    .set({
      status: 'processed',
      mediaType: 'photo',
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

/**
 * Video path: sample frames, run each through the face service, aggregate the
 * faces (search dedupes per-photo by closest distance), and store a poster
 * frame as the thumbnail. The original video is left untouched (no re-encode).
 */
async function processVideo(data: PhotoJobData, bytes: Buffer): Promise<void> {
  const { frames, durationSeconds } = await extractFrames(bytes);
  if (frames.length === 0) throw new Error('No frames extracted from video');

  // Poster from the first frame.
  const thumbStorageKey = await generateThumbnail(data.storageKey, frames[0]!);

  const allFaces: DetectedFace[] = [];
  for (const frame of frames) {
    const faces = await detectFaces(frame);
    allFaces.push(...faces);
  }
  await saveFaces(data.photoId, data.eventId, allFaces);

  await db
    .update(schema.photos)
    .set({
      status: 'processed',
      mediaType: 'video',
      durationSeconds: durationSeconds ?? null,
      faceCount: allFaces.length,
      thumbStorageKey,
      processedAt: new Date(),
      error: null,
    })
    .where(eq(schema.photos.id, data.photoId));

  logger.info(
    { photoId: data.photoId, frames: frames.length, faces: allFaces.length },
    'video processed',
  );
}
