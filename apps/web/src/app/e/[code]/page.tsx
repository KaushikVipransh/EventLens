'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  ApiError,
  attendeeToken,
  type Album,
  type AttendeeUser,
  type GalleryPhoto,
  type Person,
  type SearchMatch,
} from '@/lib/api';
import { SelfieCapture } from '@/components/SelfieCapture';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { Mark, PillButton, PlayBadge, Wordmark } from '@/components/ui';

type View = 'photos' | 'people' | 'albums' | 'videos' | 'favourites' | 'myphotos';

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  fullUrl: string;
  mediaType: 'photo' | 'video';
  createdAt?: string;
}

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'photos', label: 'Photos', icon: <IconPhotos /> },
  { view: 'people', label: 'People', icon: <IconPeople /> },
  { view: 'albums', label: 'Albums', icon: <IconAlbums /> },
  { view: 'videos', label: 'Videos', icon: <IconVideo /> },
  { view: 'favourites', label: 'Favourites', icon: <IconHeart /> },
  { view: 'myphotos', label: 'My photos', icon: <Mark className="h-5 w-5" /> },
];

export default function AttendeeGalleryPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [token, setToken] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('photos');
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState<AttendeeUser | null>(null);
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());

  // Live processing progress → auto-refresh views as photos finish.
  const [status, setStatus] = useState<{ processed: number; total: number; busy: boolean } | null>(
    null,
  );
  const [refreshTick, setRefreshTick] = useState(0);
  const lastProcessed = useRef(0);

  const favKey = `eventlens.fav.${code}`;

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s = await api.attendeeStatus(token);
        const busy = s.pending + s.processing > 0;
        setStatus({ processed: s.processed, total: s.total, busy });
        if (s.processed > lastProcessed.current) {
          lastProcessed.current = s.processed;
          setRefreshTick((t) => t + 1); // new photos ready → refresh the view
        }
        if (busy && !stopped) timer = setTimeout(poll, 6000);
      } catch {
        /* ignore transient errors */
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token]);

  useEffect(() => {
    api
      .attendeeSession(code)
      .then(({ token, event }) => {
        setToken(token);
        setEventName(event.name);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load this event.'),
      );
    const t = attendeeToken.get();
    if (t) api.attendeeMe(t).then(({ user }) => setAccount(user)).catch(() => attendeeToken.clear());
    try {
      const saved = JSON.parse(localStorage.getItem(favKey) ?? '[]') as string[];
      setFavs(new Set(saved));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const toggleFav = useCallback(
    (id: string) => {
      setFavs((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        localStorage.setItem(favKey, JSON.stringify([...next]));
        return next;
      });
    },
    [favKey],
  );

  const openLightbox = useCallback((items: MediaItem[], index: number) => {
    setViewer({ items, index });
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <Wordmark />
          <h1 className="mt-4 text-h2 font-semibold lowercase">event not found</h1>
          <p className="mt-2 text-ink/60">{error}</p>
        </div>
      </div>
    );
  }

  const shared = { token, code, favs, toggleFav, openLightbox, query, account, refreshTick };

  return (
    <div className="min-h-screen bg-cream lg:flex">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sticky top-0 z-20 flex h-auto shrink-0 flex-col gap-1 border-b border-ink/10 bg-panel/80 px-3 py-3 backdrop-blur lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="mb-2 flex items-center justify-between px-1 lg:mb-6">
          <Wordmark />
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => setView(n.view)}
              data-hover
              className={`flex shrink-0 items-center gap-3 rounded-pill px-4 py-2.5 text-sm font-medium transition lg:rounded-2xl ${
                view === n.view
                  ? 'bg-ink text-cream'
                  : 'text-ink/70 hover:bg-cream hover:text-ink'
              }`}
            >
              <span className="grid h-5 w-5 place-items-center">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-2 pt-6 text-xs text-ink/40 lg:block">
          <Link href="/account" className="font-medium text-ink/60 hover:text-ink" data-hover>
            {account ? account.name : 'Sign in'}
          </Link>
          <p className="mt-1">EventLens</p>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/10 bg-cream/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="relative flex-1 max-w-xl">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              <IconSearch />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${eventName || 'this event'}`}
              className="w-full rounded-pill border border-ink/10 bg-panel py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-ink/30"
            />
          </div>
          <Link
            href="/account"
            data-hover
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-cream"
            title={account ? account.name : 'Account'}
          >
            {account ? account.name.charAt(0).toUpperCase() : <IconUser />}
          </Link>
        </header>

        <div className="px-4 py-6 lg:px-8">
          <h1 className="mb-4 text-h2 font-semibold lowercase">{eventName || 'Loading…'}</h1>

          {status?.busy && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-panel px-4 py-3 text-sm shadow-lift">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
              <span className="text-ink/70">
                Processing photos… <strong>{status.processed}</strong> of {status.total} ready
                {' '}— new photos appear automatically.
              </span>
            </div>
          )}

          {!token ? (
            <p className="text-ink/50">Loading…</p>
          ) : view === 'photos' ? (
            <PagedView key="photos" {...shared} timeline emptyText="No photos yet — check back shortly." />
          ) : view === 'videos' ? (
            <PagedView key="videos" {...shared} mediaType="video" emptyText="No videos yet." />
          ) : view === 'albums' ? (
            <AlbumsView {...shared} />
          ) : view === 'people' ? (
            <PeopleView {...shared} />
          ) : view === 'favourites' ? (
            <FavouritesView {...shared} />
          ) : (
            <MyPhotosView {...shared} setAccount={setAccount} />
          )}
        </div>
      </main>

      {viewer && (
        <Lightbox
          items={viewer.items}
          index={viewer.index}
          token={token}
          onNavigate={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

// ── Shared props + grid ─────────────────────────────────────────────────────
interface SharedProps {
  token: string | null;
  code: string;
  favs: Set<string>;
  toggleFav: (id: string) => void;
  openLightbox: (items: MediaItem[], index: number) => void;
  query: string;
  account: AttendeeUser | null;
  /** Bumped when new photos finish processing → views re-fetch. */
  refreshTick: number;
}

const filterByQuery = <T extends { filename: string }>(items: T[], q: string): T[] =>
  q ? items.filter((i) => i.filename.toLowerCase().includes(q.toLowerCase())) : items;

function MediaGrid({
  items,
  favs,
  toggleFav,
  onOpen,
}: {
  items: MediaItem[];
  favs: Set<string>;
  toggleFav: (id: string) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((p, i) => (
        <div key={p.id} className="group relative overflow-hidden rounded-2xl bg-panel shadow-lift">
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
            {p.mediaType === 'video' && <PlayBadge />}
          </button>
          <button
            onClick={() => toggleFav(p.id)}
            className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full transition ${
              favs.has(p.id)
                ? 'bg-coral text-white opacity-100'
                : 'bg-ink/50 text-white opacity-0 group-hover:opacity-100'
            }`}
            aria-label={favs.has(p.id) ? 'Remove favourite' : 'Add favourite'}
            data-hover
          >
            <IconHeart filled={favs.has(p.id)} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Paged view (Photos timeline / Videos / Album) ───────────────────────────
function PagedView({
  token,
  favs,
  toggleFav,
  openLightbox,
  query,
  refreshTick,
  timeline,
  mediaType,
  albumId,
  emptyText,
}: SharedProps & {
  timeline?: boolean;
  mediaType?: 'photo' | 'video';
  albumId?: string;
  emptyText: string;
}) {
  const PAGE = 30;
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(PAGE); // how many items are currently shown

  useEffect(() => {
    if (!token) return;
    let live = true;
    setLoading(true);
    loadedRef.current = PAGE;
    api
      .galleryPhotos(token, 1, PAGE, { mediaType, albumId })
      .then(({ photos }) => {
        if (!live) return;
        setPhotos(photos);
        setPage(1);
        setHasMore(photos.length === PAGE);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, mediaType, albumId]);

  // Live refresh: when new photos finish processing, re-fetch the loaded window.
  useEffect(() => {
    if (!token || refreshTick === 0) return;
    const limit = Math.min(loadedRef.current, 100);
    api
      .galleryPhotos(token, 1, limit, { mediaType, albumId })
      .then(({ photos }) => {
        setPhotos(photos);
        setHasMore(photos.length === limit);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  async function loadMore() {
    if (!token) return;
    const next = page + 1;
    const { photos: more } = await api.galleryPhotos(token, next, PAGE, { mediaType, albumId });
    setPhotos((prev) => [...prev, ...more]);
    setPage(next);
    loadedRef.current = next * PAGE;
    setHasMore(more.length === PAGE);
  }

  const items = filterByQuery(photos, query) as MediaItem[];

  if (loading) return <p className="text-ink/50">Loading…</p>;
  if (items.length === 0) return <p className="text-ink/50">{emptyText}</p>;

  return (
    <>
      {timeline ? (
        groupByDate(items).map(([label, group]) => (
          <section key={label} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-ink/50">{label}</h2>
            <MediaGrid
              items={group}
              favs={favs}
              toggleFav={toggleFav}
              onOpen={(i) => openLightbox(group, i)}
            />
          </section>
        ))
      ) : (
        <MediaGrid items={items} favs={favs} toggleFav={toggleFav} onOpen={(i) => openLightbox(items, i)} />
      )}
      {hasMore && !query && (
        <div className="mt-8 flex justify-center">
          <PillButton variant="secondary" onClick={loadMore}>
            Load more
          </PillButton>
        </div>
      )}
    </>
  );
}

// ── Albums ──────────────────────────────────────────────────────────────────
function AlbumsView(props: SharedProps) {
  const { token } = props;
  const [albums, setAlbums] = useState<Album[]>([]);
  const [active, setActive] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .attendeeAlbums(token)
      .then(({ albums }) => setAlbums(albums.filter((a) => a.photoCount > 0)))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-ink/50">Loading…</p>;
  if (albums.length === 0) return <p className="text-ink/50">No albums yet.</p>;

  if (active) {
    return (
      <>
        <button
          onClick={() => setActive(null)}
          className="mb-4 text-sm text-ink/60 hover:text-ink"
          data-hover
        >
          ← All albums
        </button>
        <h2 className="mb-4 text-lg font-semibold">{active.name}</h2>
        <PagedView {...props} albumId={active.id} emptyText="No photos in this album." />
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {albums.map((a) => (
        <button
          key={a.id}
          onClick={() => setActive(a)}
          data-hover
          className="rounded-2xl bg-panel p-5 text-left shadow-lift transition hover:-translate-y-0.5"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-ink/70">
            <IconAlbums />
          </span>
          <p className="mt-3 font-medium">{a.name}</p>
          <p className="text-sm text-ink/50">{a.photoCount} photo(s)</p>
        </button>
      ))}
    </div>
  );
}

// ── People (face clusters) ──────────────────────────────────────────────────
function PeopleView({ token, favs, toggleFav, openLightbox, query }: SharedProps) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [active, setActive] = useState<Person | null>(null);

  useEffect(() => {
    if (!token) return;
    api.attendeePeople(token).then(({ people }) => setPeople(people));
  }, [token]);

  if (!people) return <p className="text-ink/50">Grouping faces…</p>;
  if (people.length === 0)
    return <p className="text-ink/50">No people detected yet — photos may still be processing.</p>;

  if (active) {
    const items = filterByQuery(active.photos, query) as MediaItem[];
    return (
      <>
        <button
          onClick={() => setActive(null)}
          className="mb-4 text-sm text-ink/60 hover:text-ink"
          data-hover
        >
          ← All people
        </button>
        <h2 className="mb-4 text-lg font-semibold">{active.count} photo(s)</h2>
        <MediaGrid items={items} favs={favs} toggleFav={toggleFav} onOpen={(i) => openLightbox(items, i)} />
      </>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {people.map((p) => (
        <button key={p.id} onClick={() => setActive(p)} data-hover className="group text-center">
          <div className="overflow-hidden rounded-full shadow-lift">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.cover?.url}
              alt="Person"
              loading="lazy"
              className="aspect-square w-full object-cover transition group-hover:scale-105"
            />
          </div>
          <p className="mt-2 text-xs text-ink/50">{p.count}</p>
        </button>
      ))}
    </div>
  );
}

// ── Favourites ──────────────────────────────────────────────────────────────
function FavouritesView({ token, favs, toggleFav, openLightbox, query }: SharedProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const ids = useMemo(() => [...favs], [favs]);

  useEffect(() => {
    if (!token) return;
    if (ids.length === 0) {
      setPhotos([]);
      return;
    }
    api.attendeePhotosByIds(token, ids).then(({ photos }) => setPhotos(photos));
    // Re-fetch only when the set of favourites changes size (add/remove).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ids.length]);

  if (!photos) return <p className="text-ink/50">Loading…</p>;
  if (photos.length === 0)
    return <p className="text-ink/50">No favourites yet — tap the heart on any photo.</p>;

  const items = filterByQuery(photos, query) as MediaItem[];
  return <MediaGrid items={items} favs={favs} toggleFav={toggleFav} onOpen={(i) => openLightbox(items, i)} />;
}

// ── My photos (selfie / saved face) ─────────────────────────────────────────
function MyPhotosView({
  token,
  code,
  favs,
  toggleFav,
  openLightbox,
  query,
  account,
  setAccount,
}: SharedProps & { setAccount: (u: AttendeeUser | null) => void }) {
  const [matches, setMatches] = useState<SearchMatch[] | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  void setAccount;

  async function onSelfie(blob: Blob) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const { matches } = await api.attendeeSearch(token, blob);
      setMatches(matches);
      setShowCamera(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function useSavedFace() {
    const t = attendeeToken.get();
    if (!t) return;
    setBusy(true);
    setErr(null);
    try {
      const { matches } = await api.attendeeSearchMe(t, code);
      setMatches(matches);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  if (matches === null) {
    return (
      <div className="grid place-items-center rounded-3xl bg-panel px-6 py-16 text-center shadow-lift">
        <Mark className="h-8 w-8 text-coral" />
        <h2 className="mt-4 text-h3 lowercase">find the photos you&apos;re in</h2>
        <p className="mt-2 max-w-md text-ink/60">
          Take a quick selfie and we&apos;ll gather every photo from this event that you appear in.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {account?.hasFace && (
            <PillButton variant="accent" onClick={useSavedFace} disabled={busy}>
              <Mark className="h-4 w-4" /> {busy ? 'Finding…' : 'Use my saved face'}
            </PillButton>
          )}
          <PillButton
            variant={account?.hasFace ? 'secondary' : 'accent'}
            onClick={() => setShowCamera(true)}
            disabled={!token}
          >
            <Mark className="h-4 w-4" /> Capture selfie
          </PillButton>
        </div>
        {!account && (
          <p className="mt-4 text-sm text-ink/50">
            <Link href="/account" className="font-medium text-ink hover:opacity-70" data-hover>
              Sign in
            </Link>{' '}
            to save your face and skip this at every event.
          </p>
        )}
        {err && <p className="mt-3 text-sm text-coral">{err}</p>}
        {showCamera && (
          <SelfieCapture onCapture={onSelfie} onClose={() => setShowCamera(false)} busy={busy} />
        )}
      </div>
    );
  }

  const items = filterByQuery(matches, query) as MediaItem[];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {matches.length > 0 ? `${matches.length} photo(s) of you` : 'No matches — try another selfie'}
        </h2>
        <div className="flex gap-3">
          {matches.length > 0 && token && (
            <PillButton variant="accent" onClick={() => api.downloadBatch(token, matches.map((m) => m.id))}>
              Download all
            </PillButton>
          )}
          <PillButton variant="secondary" onClick={() => setShowCamera(true)}>
            Retake selfie
          </PillButton>
        </div>
      </div>
      {items.length > 0 && (
        <MediaGrid items={items} favs={favs} toggleFav={toggleFav} onOpen={(i) => openLightbox(items, i)} />
      )}
      {showCamera && (
        <SelfieCapture onCapture={onSelfie} onClose={() => setShowCamera(false)} busy={busy} />
      )}
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function groupByDate(items: MediaItem[]): [string, MediaItem[]][] {
  const groups = new Map<string, MediaItem[]>();
  for (const it of items) {
    const label = it.createdAt
      ? new Date(it.createdAt).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'Undated';
    const arr = groups.get(label) ?? [];
    arr.push(it);
    groups.set(label, arr);
  }
  return [...groups.entries()];
}

// ── Icons ───────────────────────────────────────────────────────────────────
function IconPhotos() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17 20a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  );
}
function IconAlbums() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M7 6V4h10v2" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 9l4-2v10l-4-2" />
    </svg>
  );
}
function IconHeart({ filled }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
