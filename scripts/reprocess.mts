/**
 * Re-enqueue photos for face processing (e.g. after changing detection size or
 * model). The worker re-detects + re-embeds + regenerates thumbnails; the job
 * is idempotent (it clears prior faces first).
 *
 * Usage:
 *   npx tsx scripts/reprocess.mts            # all photos
 *   npx tsx scripts/reprocess.mts CODE       # only one event (by attendee code)
 */
import { db, queryClient, schema } from '@eventlens/db';
import { enqueuePhotoJob } from '@eventlens/queue';
import { eq } from 'drizzle-orm';

const code = process.argv[2];

async function main() {
  let eventFilter: string | undefined;
  if (code) {
    const ev = await db.query.events.findFirst({
      where: eq(schema.events.attendeeCode, code.toUpperCase()),
      columns: { id: true, name: true },
    });
    if (!ev) throw new Error(`No event with code ${code}`);
    eventFilter = ev.id;
    console.log(`Reprocessing event "${ev.name}" (${code})`);
  }

  const photos = await db.query.photos.findMany({
    columns: { id: true, eventId: true, storageKey: true },
    ...(eventFilter ? { where: eq(schema.photos.eventId, eventFilter) } : {}),
  });

  for (const p of photos) {
    await enqueuePhotoJob({ photoId: p.id, eventId: p.eventId, storageKey: p.storageKey });
  }
  console.log(`Enqueued ${photos.length} photo(s) for reprocessing.`);
}

try {
  await main();
} finally {
  await queryClient.end();
}
