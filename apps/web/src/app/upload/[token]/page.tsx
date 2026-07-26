'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton, Mark } from '@/components/ui';
import { Reveal } from '@/components/motion';

const uploadNavRight = <span className="text-sm text-ink/50">photographer upload</span>;

const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];
const CONCURRENCY = 4;

interface Session {
  token: string;
  photographer: { id: string; name: string };
  event: { id: string; name: string; date: string | null };
  albums: { id: string; name: string }[];
}

type ItemStatus = 'queued' | 'uploading' | 'uploaded' | 'done' | 'error';
interface Item {
  id: number;
  file: File;
  status: ItemStatus;
  storageKey?: string;
  error?: string;
}

let nextItemId = 0;

/** Run an async fn over items with a bounded concurrency pool. */
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

export default function UploadPage() {
  const params = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [albumId, setAlbumId] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api
      .uploadSession(params.token)
      .then(setSession)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'This upload link is invalid.'),
      );
  }, [params.token]);

  const counts = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length;
    const failed = items.filter((i) => i.status === 'error').length;
    return { done, failed, total: items.length };
  }, [items]);

  function addFiles(files: File[]) {
    const next: Item[] = files.map((file) =>
      ALLOWED.includes(file.type)
        ? { id: nextItemId++, file, status: 'queued' as const }
        : { id: nextItemId++, file, status: 'error' as const, error: 'unsupported format' },
    );
    setItems((prev) => [...prev, ...next]);
  }

  /** Patch a single item by its stable id. */
  function patch(id: number, p: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  async function upload() {
    if (!session) return;
    // (Re)upload everything that's queued or previously errored-but-valid.
    const targets = items.filter(
      (i) => i.status === 'queued' || (i.status === 'error' && ALLOWED.includes(i.file.type)),
    );
    if (targets.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      targets.forEach((t) => patch(t.id, { status: 'queued', error: undefined }));
      const { uploads } = await api.presign(
        session.token,
        targets.map((t) => ({ filename: t.file.name, contentType: t.file.type, size: t.file.size })),
      );

      // Track results locally (React state is async / can't be read back here).
      const succeeded: { id: number; file: File; storageKey: string }[] = [];

      await runPool(
        targets.map((t, idx) => ({ t, u: uploads[idx]! })),
        CONCURRENCY,
        async ({ t, u }) => {
          patch(t.id, { status: 'uploading' });
          try {
            const res = await fetch(u.uploadUrl, {
              method: 'PUT',
              headers: { 'content-type': t.file.type },
              body: t.file,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            patch(t.id, { status: 'uploaded', storageKey: u.storageKey });
            succeeded.push({ id: t.id, file: t.file, storageKey: u.storageKey });
          } catch (e) {
            patch(t.id, { status: 'error', error: e instanceof Error ? e.message : 'upload failed' });
          }
        },
      );

      // Register the successfully uploaded files.
      if (succeeded.length > 0) {
        await api.complete(
          session.token,
          succeeded.map((s) => ({
            storageKey: s.storageKey,
            filename: s.file.name,
            contentType: s.file.type,
            size: s.file.size,
          })),
          albumId || undefined,
        );
        const doneIds = new Set(succeeded.map((s) => s.id));
        setItems((prev) =>
          prev.map((i) => (doneIds.has(i.id) ? { ...i, status: 'done' as const } : i)),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) {
    return (
      <main className="min-h-screen">
        <Nav right={uploadNavRight} />
        <div className="mx-auto max-w-md px-6 py-16">
          <Card>
            <h1 className="text-h2 font-semibold lowercase">link not valid</h1>
            <p className="mt-2 text-sm text-ink/60">{error}</p>
          </Card>
        </div>
      </main>
    );
  }

  const pendingCount = items.filter(
    (i) => i.status === 'queued' || (i.status === 'error' && ALLOWED.includes(i.file.type)),
  ).length;
  const progress = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Nav right={uploadNavRight} />
      <GradientBlob className="right-[-10%] top-[10%] h-96 w-96" color="#F0997B" />
      <div className="relative z-10 mx-auto max-w-lg px-6 py-12">
        <Reveal>
          <Card>
            <span className="text-coral">
              <Mark />
            </span>
            <h1 className="mt-2 text-h2 font-semibold lowercase">
              {session ? `upload to ${session.event.name}` : 'Loading…'}
            </h1>
            {session && (
              <p className="mt-1 text-sm text-ink/60">
                Uploading as <strong>{session.photographer.name}</strong>. Drag in a whole batch —
                they upload in parallel and process automatically.
              </p>
            )}

            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
              className={`mt-6 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver ? 'border-coral bg-coral/5' : 'border-ink/15 bg-cream-light'
              }`}
            >
              <p className="text-sm text-ink/60">Drag & drop photos here</p>
              <p className="my-2 text-xs text-ink/40">or</p>
              <label className="inline-block cursor-pointer rounded-pill bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black">
                Choose files
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              <p className="mt-3 text-[11px] text-ink/40">Photos (JPEG/PNG/WebP) or video (MP4/MOV/WebM)</p>
            </div>

            {session && session.albums.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium text-ink/70">Album</label>
                <select
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-ink/15 bg-cream-light px-4 py-2.5 text-sm outline-none focus:border-ink/40"
                >
                  <option value="">All photos (no album)</option>
                  {session.albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {items.length > 0 && (
              <>
                <div className="mt-5 flex items-center justify-between text-sm text-ink/60">
                  <span>
                    {counts.total} file(s) · {counts.done} done
                    {counts.failed > 0 && <span className="text-coral"> · {counts.failed} failed</span>}
                  </span>
                  <button
                    onClick={() => setItems([])}
                    disabled={busy}
                    className="text-xs text-ink/40 hover:text-ink"
                    data-hover
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-cream">
                  <div className="h-full bg-grass transition-all" style={{ width: `${progress}%` }} />
                </div>
                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-ink/70">{it.file.name}</span>
                      <StatusBadge item={it} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {error && session && <p className="mt-3 text-sm text-coral">{error}</p>}

            <PillButton
              onClick={upload}
              disabled={busy || pendingCount === 0 || !session}
              className="mt-6 w-full"
            >
              {busy
                ? 'Uploading…'
                : counts.failed > 0
                  ? `Retry ${pendingCount} photo(s)`
                  : `Upload ${pendingCount} photo(s)`}
            </PillButton>
          </Card>
        </Reveal>
      </div>
    </main>
  );
}

function StatusBadge({ item }: { item: Item }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    queued: { label: 'queued', cls: 'text-ink/40' },
    uploading: { label: 'uploading…', cls: 'text-sky' },
    uploaded: { label: 'saved', cls: 'text-grass' },
    done: { label: '✓ done', cls: 'text-grass' },
    error: { label: item.error ?? 'failed', cls: 'text-coral' },
  };
  const s = map[item.status];
  return <span className={`shrink-0 ${s.cls}`}>{s.label}</span>;
}
