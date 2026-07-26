'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type Album, type OrganizerPhoto } from '@/lib/api';
import { Lightbox, type LightboxItem } from './Lightbox';
import { PillButton, PlayBadge } from './ui';

const PAGE_SIZE = 24;

const statusStyles: Record<OrganizerPhoto['status'], string> = {
  pending: 'bg-amber/20 text-amber',
  processing: 'bg-amber/20 text-amber',
  processed: 'bg-grass/15 text-grass',
  failed: 'bg-coral/15 text-coral',
};

/** Organizer-facing gallery: browse every photo in an event, open in the
 *  lightbox, filter by album, and delete unwanted photos (storage control). */
export function EventPhotos({
  token,
  eventId,
  albums,
}: {
  token: string;
  eventId: string;
  albums: Album[];
}) {
  const [photos, setPhotos] = useState<OrganizerPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [albumFilter, setAlbumFilter] = useState<string | undefined>(undefined);
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; index: number } | null>(null);

  const load = useCallback(
    async (album: string | undefined, nextPage: number, append: boolean) => {
      setLoading(true);
      try {
        const { photos: rows } = await api.listEventPhotos(token, eventId, nextPage, PAGE_SIZE, album);
        setPhotos((prev) => (append ? [...prev, ...rows] : rows));
        setPage(nextPage);
        setHasMore(rows.length === PAGE_SIZE);
      } finally {
        setLoading(false);
      }
    },
    [token, eventId],
  );

  useEffect(() => {
    void load(undefined, 1, false);
  }, [load]);

  function selectAlbum(album: string | undefined) {
    setAlbumFilter(album);
    void load(album, 1, false);
  }

  async function remove(photo: OrganizerPhoto) {
    if (!confirm(`Delete “${photo.filename}”? This can't be undone.`)) return;
    await api.deleteEventPhoto(token, eventId, photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  return (
    <div>
      {albums.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip active={!albumFilter} onClick={() => selectAlbum(undefined)}>
            All
          </FilterChip>
          {albums.map((a) => (
            <FilterChip key={a.id} active={albumFilter === a.id} onClick={() => selectAlbum(a.id)}>
              {a.name} <span className="opacity-50">{a.photoCount}</span>
            </FilterChip>
          ))}
        </div>
      )}

      {photos.length === 0 && !loading ? (
        <p className="text-sm text-ink/50">No photos here yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative overflow-hidden rounded-xl bg-cream shadow-lift">
              <button
                type="button"
                onClick={() => setViewer({ items: photos, index: i })}
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
                  className="aspect-square w-full object-cover transition group-hover:scale-[1.03]"
                />
                {p.mediaType === 'video' && <PlayBadge />}
              </button>
              {p.status !== 'processed' && (
                <span
                  className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[p.status]}`}
                >
                  {p.status}
                </span>
              )}
              <button
                onClick={() => remove(p)}
                className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 p-1.5 text-white opacity-0 transition hover:bg-coral group-hover:opacity-100"
                aria-label="Delete photo"
                data-hover
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <PillButton
            variant="secondary"
            onClick={() => load(albumFilter, page + 1, true)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </PillButton>
        </div>
      )}

      {viewer && (
        <Lightbox
          items={viewer.items}
          index={viewer.index}
          token={null}
          onNavigate={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
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
        active ? 'bg-ink text-cream' : 'bg-cream text-ink/70 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
