/**
 * EventLens end-to-end happy-path smoke test.
 *
 * Exercises the full core loop against running services (api + worker + face):
 *   login → create event → add photographer → upload a real face photo →
 *   wait for background processing → attendee selfie search → batch download.
 *
 * Prereqs: `docker compose up -d`, `npm run db:migrate && npm run db:seed`,
 * plus `npm run dev:api` and `npm run dev:worker` running.
 *
 * Usage: npx tsx scripts/e2e.mts [path-to-face-image.jpg]
 */
import { readFile } from 'node:fs/promises';

const API = process.env.API_BASE_URL ?? 'http://localhost:4000';
const IMAGE = process.argv[2] ?? 'scripts/sample-face.jpg';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function j(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => null);
  assert(res.ok, `${opts.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const json = { 'content-type': 'application/json' };

async function main() {
  console.log('1. login demo organizer');
  const { token: org } = await j('/auth/login', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email: 'demo@eventlens.test', password: 'password123' }),
  });

  console.log('2. create event');
  const { event } = await j('/events', {
    method: 'POST',
    headers: { ...json, ...auth(org) },
    body: JSON.stringify({ name: `E2E ${Date.now()}` }),
  });

  console.log('3. add photographer');
  const { photographer } = await j(`/events/${event.id}/photographers`, {
    method: 'POST',
    headers: { ...json, ...auth(org) },
    body: JSON.stringify({ name: 'E2E Photographer' }),
  });

  console.log('4. photographer upload session');
  const { token: pho } = await j('/uploads/session', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ uploadToken: photographer.uploadToken }),
  });

  const image = await readFile(IMAGE);
  console.log(`5. presign + upload ${IMAGE} (${image.length} bytes)`);
  const { uploads } = await j('/uploads/presign', {
    method: 'POST',
    headers: { ...json, ...auth(pho) },
    body: JSON.stringify({
      files: [{ filename: 'face.jpg', contentType: 'image/jpeg', size: image.length }],
    }),
  });
  const put = await fetch(uploads[0].uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg' },
    body: image,
  });
  assert(put.ok, `PUT to storage → ${put.status}`);

  await j('/uploads/complete', {
    method: 'POST',
    headers: { ...json, ...auth(pho) },
    body: JSON.stringify({
      photos: [
        {
          storageKey: uploads[0].storageKey,
          filename: 'face.jpg',
          contentType: 'image/jpeg',
          size: image.length,
        },
      ],
    }),
  });

  console.log('6. attendee session');
  const { token: att } = await j('/attendee/session', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ code: event.attendeeCode }),
  });

  console.log('7. wait for background processing (photo appears in gallery)…');
  let processed = false;
  for (let i = 0; i < 60; i++) {
    const { photos } = await j('/attendee/photos', { headers: auth(att) });
    if (photos.length >= 1) {
      processed = true;
      console.log(`   processed after ~${i * 2}s (faceCount=${photos[0].faceCount})`);
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  assert(processed, 'photo was not processed within 120s');

  console.log('8. selfie search with the same face');
  const search = await fetch(`${API}/attendee/search`, {
    method: 'POST',
    headers: { ...auth(att), 'content-type': 'image/jpeg' },
    body: image,
  });
  const searchData = await search.json();
  assert(search.ok, `search → ${search.status} ${JSON.stringify(searchData)}`);
  assert(searchData.count >= 1, `expected >=1 match, got ${searchData.count}`);
  console.log(`   matched ${searchData.count} photo(s), best distance=${searchData.matches[0].distance.toFixed(4)}`);

  console.log('9. batch download');
  const zip = await fetch(`${API}/attendee/download-batch`, {
    method: 'POST',
    headers: { ...auth(att), ...json },
    body: JSON.stringify({ photoIds: searchData.matches.map((m: any) => m.id) }),
  });
  const buf = Buffer.from(await zip.arrayBuffer());
  assert(zip.ok && buf.length > 0, `zip download → ${zip.status}, ${buf.length} bytes`);
  console.log(`   downloaded zip (${buf.length} bytes)`);

  console.log('\n✅ E2E PASSED');
}

main().catch((err) => {
  console.error('\n❌ E2E FAILED:', err.message);
  process.exit(1);
});
