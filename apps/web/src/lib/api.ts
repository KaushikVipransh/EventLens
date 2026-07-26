// Typed client for the EventLens API. Browser-side; tokens live in localStorage.

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

async function request<T>(
  path: string,
  opts: { method?: string; body?: Json; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data as Json)?.error?.toString() ?? 'Request failed', data);
  }
  return data as T;
}

// ── Token storage ─────────────────────────────────────────────────────────────
const ORG_KEY = 'eventlens.organizer.token';

export const orgToken = {
  get: () => (typeof window === 'undefined' ? null : localStorage.getItem(ORG_KEY)),
  set: (t: string) => localStorage.setItem(ORG_KEY, t),
  clear: () => localStorage.removeItem(ORG_KEY),
};

// ── Shared types ──────────────────────────────────────────────────────────────
export interface Organizer {
  id: string;
  email: string;
  name: string;
}
export interface EventRecord {
  id: string;
  name: string;
  date: string | null;
  attendeeCode: string;
  createdAt: string;
}
export interface Photographer {
  id: string;
  name: string;
  uploadToken: string;
  uploadLink: string;
}
export interface Album {
  id: string;
  name: string;
  photoCount: number;
}
export interface ShareLink {
  id: string;
  token: string;
  albumId: string | null;
  albumName: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  createdAt: string;
  url: string;
}
export interface GalleryPhoto {
  id: string;
  filename: string;
  faceCount: number;
  url: string;
  /** Full-resolution presigned URL, used by the lightbox on open. */
  fullUrl: string;
}
export interface SharePhoto {
  id: string;
  filename: string;
  url: string;
  fullUrl: string;
}
export interface OrganizerPhoto {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  faceCount: number;
  albumId: string | null;
  url: string;
  fullUrl: string;
}
export interface SearchMatch {
  id: string;
  filename: string;
  distance: number;
  url: string;
  /** Full-resolution presigned URL, used by the lightbox on open. */
  fullUrl: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  signup: (body: { email: string; password: string; name: string }) =>
    request<{ token: string; organizer: Organizer }>('/auth/signup', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; organizer: Organizer }>('/auth/login', { method: 'POST', body }),
  me: (token: string) => request<{ organizer: Organizer }>('/auth/me', { token }),

  // Events (organizer)
  createEvent: (token: string, body: { name: string; date?: string }) =>
    request<{ event: EventRecord }>('/events', { method: 'POST', body, token }),
  listEvents: (token: string) => request<{ events: EventRecord[] }>('/events', { token }),
  getEvent: (token: string, id: string) => request<{ event: EventRecord }>(`/events/${id}`, { token }),
  addPhotographer: (token: string, id: string, body: { name: string }) =>
    request<{ photographer: Photographer; uploadLink: string }>(`/events/${id}/photographers`, {
      method: 'POST',
      body,
      token,
    }),
  listPhotographers: (token: string, id: string) =>
    request<{ photographers: Photographer[] }>(`/events/${id}/photographers`, { token }),
  attendeeLink: (token: string, id: string) =>
    request<{ code: string; attendeeLink: string }>(`/events/${id}/attendee-link`, { token }),

  // Albums (organizer)
  createAlbum: (token: string, id: string, body: { name: string }) =>
    request<{ album: Album }>(`/events/${id}/albums`, { method: 'POST', body, token }),
  listAlbums: (token: string, id: string) =>
    request<{ albums: Album[] }>(`/events/${id}/albums`, { token }),
  deleteAlbum: (token: string, id: string, albumId: string) =>
    request<null>(`/events/${id}/albums/${albumId}`, { method: 'DELETE', token }),

  // Photos (organizer view + management)
  listEventPhotos: (token: string, id: string, page = 1, limit = 24, albumId?: string) =>
    request<{ page: number; limit: number; photos: OrganizerPhoto[] }>(
      `/events/${id}/photos?page=${page}&limit=${limit}${albumId ? `&albumId=${albumId}` : ''}`,
      { token },
    ),
  deleteEventPhoto: (token: string, id: string, photoId: string) =>
    request<null>(`/events/${id}/photos/${photoId}`, { method: 'DELETE', token }),

  // Share links (organizer)
  createShareLink: (
    token: string,
    id: string,
    body: { albumId?: string; allowDownload: boolean; expiresInDays?: number },
  ) => request<{ link: ShareLink }>(`/events/${id}/share`, { method: 'POST', body, token }),
  listShareLinks: (token: string, id: string) =>
    request<{ links: ShareLink[] }>(`/events/${id}/share`, { token }),
  deleteShareLink: (token: string, id: string, linkId: string) =>
    request<null>(`/events/${id}/share/${linkId}`, { method: 'DELETE', token }),

  // Share links (public — the token is the credential, no auth header)
  getShare: (token: string, page = 1, limit = 40) =>
    request<{
      event: { name: string };
      album: { name: string } | null;
      allowDownload: boolean;
      page: number;
      limit: number;
      photos: SharePhoto[];
    }>(`/share/${token}?page=${page}&limit=${limit}`),
  shareDownloadPhoto: async (token: string, photoId: string, filename: string) => {
    const res = await fetch(`${BASE}/share/${token}/photos/${photoId}/download`);
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    saveBlob(await res.blob(), filename);
  },
  shareDownloadBatch: async (token: string, photoIds: string[]) => {
    const res = await fetch(`${BASE}/share/${token}/download-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    saveBlob(await res.blob(), 'eventlens-photos.zip');
  },

  // Uploads (photographer)
  uploadSession: (uploadToken: string) =>
    request<{
      token: string;
      photographer: { id: string; name: string };
      event: { id: string; name: string; date: string | null };
      albums: { id: string; name: string }[];
    }>('/uploads/session', { method: 'POST', body: { uploadToken } }),
  presign: (
    token: string,
    files: { filename: string; contentType: string; size: number }[],
  ) =>
    request<{ uploads: { filename: string; storageKey: string; uploadUrl: string }[] }>(
      '/uploads/presign',
      { method: 'POST', body: { files }, token },
    ),
  complete: (
    token: string,
    photos: { storageKey: string; filename: string; contentType: string; size: number }[],
    albumId?: string,
  ) =>
    request<{ queued: number }>('/uploads/complete', {
      method: 'POST',
      body: { photos, ...(albumId ? { albumId } : {}) },
      token,
    }),

  // Attendee
  attendeeSession: (code: string) =>
    request<{ token: string; event: { id: string; name: string; date: string | null } }>(
      '/attendee/session',
      { method: 'POST', body: { code } },
    ),
  galleryPhotos: (token: string, page = 1, limit = 40, albumId?: string) =>
    request<{ page: number; limit: number; photos: GalleryPhoto[] }>(
      `/attendee/photos?page=${page}&limit=${limit}${albumId ? `&albumId=${albumId}` : ''}`,
      { token },
    ),

  /** Albums (with processed-photo counts) for the attendee's event. */
  attendeeAlbums: (token: string) =>
    request<{ albums: Album[] }>('/attendee/albums', { token }),

  /** Send a selfie (image blob) and get matching photos. */
  attendeeSearch: async (token: string, image: Blob) => {
    const res = await fetch(`${BASE}/attendee/search`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': image.type || 'image/jpeg' },
      body: image,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Search failed', data);
    return data as { count: number; matches: SearchMatch[] };
  },

  downloadPhoto: async (token: string, id: string, filename: string) => {
    const res = await fetch(`${BASE}/attendee/photos/${id}/download`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    saveBlob(await res.blob(), filename);
  },

  downloadBatch: async (token: string, photoIds: string[]) => {
    const res = await fetch(`${BASE}/attendee/download-batch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    saveBlob(await res.blob(), 'eventlens-photos.zip');
  },
};

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const apiBase = BASE;
