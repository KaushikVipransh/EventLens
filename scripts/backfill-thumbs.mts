/**
 * Backfill gallery thumbnails for already-processed photos that predate the
 * thumbnail feature. Light-weight: downloads each original, resizes, uploads a
 * thumb, and records the key — no face-service calls. Runs one at a time to
 * keep memory low on constrained machines.
 *
 * Usage: npx tsx scripts/backfill-thumbs.mts
 */
import { db, queryClient, schema } from '@eventlens/db';
import { and, eq, isNull } from 'drizzle-orm';
import sharp from 'sharp';
import { getObjectBytes, putObject } from '../apps/worker/src/storage.js';

async function main() {
  const pending = await db.query.photos.findMany({
    where: and(eq(schema.photos.status, 'processed'), isNull(schema.photos.thumbStorageKey)),
    columns: { id: true, storageKey: true },
  });
  console.log(`${pending.length} processed photo(s) need thumbnails`);

  let done = 0;
  for (const p of pending) {
    try {
      const bytes = await getObjectBytes(p.storageKey);
      const thumb = await sharp(bytes)
        .rotate()
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer();
      const thumbKey = `thumb/${p.storageKey}.jpg`;
      await putObject(thumbKey, thumb, 'image/jpeg');
      await db
        .update(schema.photos)
        .set({ thumbStorageKey: thumbKey })
        .where(eq(schema.photos.id, p.id));
      done++;
      if (done % 10 === 0 || done === pending.length) {
        console.log(`  ${done}/${pending.length}`);
      }
    } catch (err) {
      console.error(`  failed for ${p.id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`Done: ${done} thumbnails generated`);
}

try {
  await main();
} finally {
  await queryClient.end();
}
