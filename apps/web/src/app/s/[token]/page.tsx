'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, type SharePhoto } from '@/lib/api';
import { Lightbox } from '@/components/Lightbox';
import { GradientBlob, Nav, PillButton } from '@/components/ui';

const navRight = <span className="text-sm text-ink/50">shared gallery</span>;

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const PAGE_SIZE = 24;

  const [title, setTitle] = useState('');
  const [allowDownload, setAllowDownload] = useState(false);
  const [photos, setPhotos] = useState<SharePhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ index: number } | null>(null);

  useEffect(() => {
    api
      .getShare(token, 1, PAGE_SIZE)
      .then((res) => {
        setTitle(res.album ? `${res.event.name} · ${res.album.name}` : res.event.name);
        setAllowDownload(res.allowDownload);
        setPhotos(res.photos);
        setHasMore(res.photos.length === PAGE_SIZE);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'This link is not available.'),
      );
  }, [token]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await api.getShare(token, next, PAGE_SIZE);
      setPhotos((prev) => [...prev, ...res.photos]);
      setPage(next);
      setHasMore(res.photos.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <Nav right={navRight} />
        <div className="grid place-items-center px-6 py-24 text-center">
          <div>
            <h1 className="text-h2 font-semibold lowercase">link unavailable</h1>
            <p className="mt-2 text-ink/60">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden pb-16">
      <Nav right={navRight} />
      <GradientBlob className="right-[-8%] top-[6%] h-80 w-80" color="#8B6FD9" />

      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-6 py-10">
        <div>
          <p className="text-sm uppercase tracking-widest text-ink/40">shared gallery</p>
          <h1 className="text-h1 lowercase">{title || 'Loading…'}</h1>
        </div>
        {allowDownload && photos.length > 0 && (
          <PillButton
            variant="accent"
            onClick={() => api.shareDownloadBatch(token, photos.map((p) => p.id))}
          >
            Download all
          </PillButton>
        )}
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative overflow-hidden rounded-card bg-panel shadow-lift">
              <button
                type="button"
                onClick={() => setViewer({ index: i })}
                data-hover
                className="block w-full"
                aria-label={`Open ${p.filename}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.filename}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full bg-cream object-cover transition group-hover:scale-[1.03]"
                />
              </button>
              {allowDownload && (
                <button
                  onClick={() => api.shareDownloadPhoto(token, p.id, p.filename)}
                  className="absolute right-2 top-2 rounded-full bg-ink/70 p-2 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Download photo"
                >
                  ↓
                </button>
              )}
            </div>
          ))}
        </div>
        {photos.length === 0 && <p className="mt-6 text-ink/50">No photos to show yet.</p>}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <PillButton variant="secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more photos'}
            </PillButton>
          </div>
        )}
      </div>

      {viewer && (
        <Lightbox
          items={photos}
          index={viewer.index}
          token={null}
          onDownload={
            allowDownload ? (item) => api.shareDownloadPhoto(token, item.id, item.filename) : undefined
          }
          onNavigate={(index) => setViewer({ index })}
          onClose={() => setViewer(null)}
        />
      )}
    </main>
  );
}
