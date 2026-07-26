'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, type Album, type GalleryPhoto, type SearchMatch } from '@/lib/api';
import { SelfieCapture } from '@/components/SelfieCapture';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { GradientBlob, Nav, PillButton, Mark } from '@/components/ui';

const galleryNavRight = <span className="text-sm text-ink/50">guest gallery</span>;

type Tab = 'all' | 'mine';

export default function AttendeeGalleryPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const PAGE_SIZE = 24;
  const [token, setToken] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumFilter, setAlbumFilter] = useState<string | undefined>(undefined);

  const [showCamera, setShowCamera] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('all');
  // Which list + index the lightbox is showing (null = closed).
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  useEffect(() => {
    api
      .attendeeSession(code)
      .then(async ({ token, event }) => {
        setToken(token);
        setEventName(event.name);
        const [{ photos }, { albums }] = await Promise.all([
          api.galleryPhotos(token, 1, PAGE_SIZE),
          api.attendeeAlbums(token),
        ]);
        setPhotos(photos);
        setHasMore(photos.length === PAGE_SIZE);
        setAlbums(albums.filter((a) => a.photoCount > 0));
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this event.'),
      );
  }, [code]);

  async function selectAlbum(id: string | undefined) {
    if (!token) return;
    setAlbumFilter(id);
    setPage(1);
    const { photos } = await api.galleryPhotos(token, 1, PAGE_SIZE, id);
    setPhotos(photos);
    setHasMore(photos.length === PAGE_SIZE);
  }

  async function loadMore() {
    if (!token || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const { photos: more } = await api.galleryPhotos(token, next, PAGE_SIZE, albumFilter);
      setPhotos((prev) => [...prev, ...more]);
      setPage(next);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onSelfie(blob: Blob) {
    if (!token) return;
    setSearching(true);
    setSearchError(null);
    try {
      const { matches } = await api.attendeeSearch(token, blob);
      setMatches(matches);
      setShowCamera(false);
      setTab('mine'); // jump straight to "my photos"
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <Nav right={galleryNavRight} />
        <div className="grid place-items-center px-6 py-24 text-center">
          <div>
            <h1 className="text-h2 font-semibold lowercase">event not found</h1>
            <p className="mt-2 text-ink/60">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const hasSelfie = matches !== null;

  return (
    <main className="relative min-h-screen overflow-hidden pb-28">
      <Nav right={galleryNavRight} />
      <GradientBlob className="right-[-8%] top-[6%] h-80 w-80" color="#F0997B" />
      <GradientBlob className="left-[-8%] top-[26%] h-72 w-72" color="#8B6FD9" />

      <header className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm uppercase tracking-widest text-ink/40">event gallery</p>
        <h1 className="text-h1 lowercase">{eventName || 'Loading…'}</h1>
      </header>

      {/* Section tabs */}
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="inline-flex rounded-full bg-panel/70 p-1 shadow-lift backdrop-blur">
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            All photos
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            <Mark className="h-3.5 w-3.5" /> My photos
            {hasSelfie && (
              <span className="ml-1 rounded-full bg-ink/10 px-1.5 py-0.5 text-xs">
                {matches!.length}
              </span>
            )}
          </TabButton>
        </div>
      </div>

      {/* ── All photos ─────────────────────────────────────────── */}
      {tab === 'all' && (
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          {albums.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <FilterChip active={!albumFilter} onClick={() => selectAlbum(undefined)}>
                All photos
              </FilterChip>
              {albums.map((a) => (
                <FilterChip
                  key={a.id}
                  active={albumFilter === a.id}
                  onClick={() => selectAlbum(a.id)}
                >
                  {a.name} <span className="opacity-50">{a.photoCount}</span>
                </FilterChip>
              ))}
            </div>
          )}
          <PhotoGrid
            items={photos}
            token={token}
            onOpen={(index) => setViewer({ items: photos, index })}
          />
          {photos.length === 0 && (
            <p className="mt-6 text-ink/50">No processed photos yet — check back shortly.</p>
          )}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <PillButton variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more photos'}
              </PillButton>
            </div>
          )}
        </div>
      )}

      {/* ── My photos ──────────────────────────────────────────── */}
      {tab === 'mine' && (
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          {!hasSelfie ? (
            <div className="mt-10 grid place-items-center rounded-card bg-panel/60 px-6 py-16 text-center shadow-lift backdrop-blur">
              <Mark className="h-8 w-8 text-accent" />
              <h2 className="mt-4 text-h3 lowercase">find the photos you're in</h2>
              <p className="mt-2 max-w-md text-ink/60">
                Take a quick selfie and we'll instantly gather every photo from this event that
                you appear in — right here, in your own section.
              </p>
              <div className="mt-6">
                <PillButton variant="accent" onClick={() => setShowCamera(true)} disabled={!token}>
                  <Mark className="h-4 w-4" /> Capture selfie
                </PillButton>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {matches!.length > 0
                    ? `${matches!.length} photo(s) of you`
                    : 'No matches yet — try another selfie'}
                </h2>
                <div className="flex gap-3">
                  {matches!.length > 0 && token && (
                    <PillButton
                      variant="accent"
                      onClick={() => api.downloadBatch(token, matches!.map((m) => m.id))}
                    >
                      Download all
                    </PillButton>
                  )}
                  <PillButton variant="secondary" onClick={() => setShowCamera(true)}>
                    Retake selfie
                  </PillButton>
                </div>
              </div>
              {matches!.length > 0 ? (
                <PhotoGrid
                  items={matches!}
                  token={token}
                  onOpen={(index) => setViewer({ items: matches!, index })}
                />
              ) : (
                <p className="mt-6 text-ink/50">
                  We couldn't find you yet. Try a clearer, front-facing selfie.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Persistent "find my photos" action */}
      <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
        <PillButton
          variant="accent"
          onClick={() => setShowCamera(true)}
          className="shadow-lift"
          disabled={!token}
        >
          <Mark className="h-4 w-4" /> {hasSelfie ? 'Retake selfie' : 'Find my photos'}
        </PillButton>
      </div>

      {searchError && (
        <p className="fixed inset-x-0 bottom-20 z-30 text-center text-sm text-coral">{searchError}</p>
      )}

      {showCamera && (
        <SelfieCapture onCapture={onSelfie} onClose={() => setShowCamera(false)} busy={searching} />
      )}

      {viewer && (
        <Lightbox
          items={viewer.items}
          index={viewer.index}
          token={token}
          onNavigate={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-hover
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-ink text-cream shadow-lift' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-hover
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-ink text-cream' : 'bg-panel/70 text-ink/70 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function PhotoGrid({
  items,
  token,
  onOpen,
}: {
  items: (GalleryPhoto | SearchMatch)[];
  token: string | null;
  onOpen: (index: number) => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((p, i) => (
        <div key={p.id} className="group relative overflow-hidden rounded-card bg-panel shadow-lift">
          <button
            type="button"
            onClick={() => onOpen(i)}
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
          {token && (
            <button
              onClick={() => api.downloadPhoto(token, p.id, p.filename)}
              className="absolute right-2 top-2 rounded-full bg-ink/70 p-2 text-white opacity-0 transition group-hover:opacity-100"
              aria-label="Download photo"
            >
              ↓
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
