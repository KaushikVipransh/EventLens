# EventLens — Product Scope

> **Vision:** *Google Photos + Google Drive's sharing/organization layer, specialized for
> events — with AI face-based retrieval as the killer feature.*
>
> A free platform where organizers create events, photographers upload media in bulk, and
> attendees instantly find every photo they're in by uploading a single selfie — then organize,
> share, and download at scale.

**Status of this document:** living scope / master roadmap. `PRD.md` describes the original MVP;
this supersedes it as the full-product target. `DEPLOYMENT.md` covers shipping it.

---

## 1. Where we are today (the MVP, already built)

The core loop works end-to-end:

- **Organizer** signs up, logs in, creates events.
- **Photographer** uploads photos via a tokenized link (no account needed).
- **Pipeline** (worker): face detection → ArcFace 512-d embeddings (`buffalo_l`) → thumbnails → pgvector.
- **Attendee** joins via event code/link, uploads a selfie, gets *their* matched photos, downloads them.
- **Infra:** 3 auth audiences (organizer/attendee/photographer), thumbnail gallery, presigned
  downloads, pgvector HNSW cosine search, production-swap-ready architecture.

Everything below is what turns this MVP into the full product.

---

## 2. Google Drive / Photos capability map → EventLens

Honest mapping of what the big products do and whether it belongs in EventLens.

| Google capability | EventLens equivalent | Verdict | Phase |
|---|---|---|---|
| Upload any file | Upload photos **and videos** (media-focused, not arbitrary files) | ✅ In (media only) | 1–2 |
| Folders / hierarchy | **Events → Albums → (sub-albums)** | ✅ In | 2 |
| Rename / move / organize | Move media between albums, rename albums | ✅ In | 2 |
| Star / favorite | Favorite/heart photos | ✅ In | 3 |
| Search by name/type/date | Filter by date, uploader, album, file type | ✅ In | 3 |
| **Search by face (Photos "People")** | **Selfie search + auto face-grouping** | ✅ **Core** | 1 (done) → 3 |
| Thumbnails / previews | Grid thumbnails, lightbox viewer, video preview | ✅ In | 1 (done) → 2 |
| Sharing links + permissions | Event/album share links, roles, expiry, password | ✅ In | 2–3 |
| Comments | Comments/reactions on photos | ⚠️ Maybe | 4 |
| Version history | Not meaningful for photos (media is immutable) | ❌ Out | — |
| Trash / restore | Soft-delete + 30-day trash + restore | ✅ In | 3 |
| Storage quotas | Per-organizer storage quota + usage meter | ✅ In | 3 |
| Auto-expiry of events | — | ❌ Out (user decision) | — |
| Activity log | "Who viewed/downloaded what" for organizers | ✅ In | 4 |
| Desktop/mobile sync client | Native sync app | ❌ Out (web + PWA instead) | — |
| Offline access | PWA offline viewing of cached results | ⚠️ Maybe | 5 |
| Shared drives (teams) | Multi-organizer / team workspaces | ⚠️ Maybe | 5 |
| **Docs/Sheets/Slides editing** | — | ❌ **Explicitly out** (see §6) | — |
| Notifications | "Your photos are ready" email/push | ✅ In | 3 |
| OCR / content search | Not relevant to event photos | ❌ Out | — |

---

## 3. Full feature scope by domain

### 3.1 Accounts & identity
- Organizer accounts (email/password → later OAuth: Google/Apple).
- **Optional attendee accounts** — so an attendee can save their face, revisit results across
  events, and get notified. (Today attendees are anonymous per-event.)
- Photographer accounts (optional) with a portfolio of events they've shot.
- Roles & permissions: owner, co-organizer, photographer, viewer.
- Password reset, email verification, session management.

### 3.2 Storage & media
- **Photos** (JPEG/PNG/WEBP/HEIC — HEIC transcode on ingest).
- **Videos** (MP4/MOV) — thumbnail + face detection on sampled frames.
- Original + generated derivatives (thumbnail, web-optimized, download-optimized).
- **Server-side compression** on ingest (cap long edge ~2500px for web; keep original for
  download) — critical for the "free + large events" cost model.
- Storage keyed per event; lifecycle rules for trashed items.

### 3.3 Organization
- **Events → Albums → sub-albums** hierarchy (the "folders" of EventLens).
- Move / copy / rename / reorder.
- **Auto-albums by person** (face clusters), by date, by uploader.
- Tags/labels; favorites; bulk selection + bulk actions.
- Cover photos for events/albums.

### 3.4 Upload
- Bulk / drag-and-drop / folder upload with progress + resumable uploads.
- Direct-to-storage presigned uploads (already the pattern) at scale.
- Duplicate detection (hash-based).
- Upload from mobile camera.
- Ingest queue status visible to photographer ("120/500 processed").

### 3.5 Viewing & preview
- Responsive masonry/grid gallery with lazy loading + infinite scroll.
- **Google Photos / Drive-style lightbox** — click any photo to open full-screen: zoom in/out
  (wheel, buttons, double-click, pinch), pan when zoomed, prev/next (arrow keys + on-screen),
  Esc/backdrop to close, download, filename/metadata. This is the standard viewer everywhere.
- Video player.
- EXIF/metadata panel (date, camera) for organizers.

### 3.5a Attendee dual-section gallery (locked requirement)
When an attendee enters an event they see a **two-section gallery**:
- **"All photos"** — the full event gallery (normal grid view), available immediately.
- **"My photos"** — populated after they capture/upload a selfie: their face-matched photos,
  shown in a **dedicated, persistent section** (a tab), not a one-off result screen. It stays
  available for the rest of the visit alongside "All photos" — the attendee can switch between
  the two freely and both behave like a normal scrollable gallery with the lightbox.

### 3.6 Search & retrieval (the differentiator)
- **Selfie search** (done) — tuned threshold, ranked by similarity.
- **Auto face-grouping** — cluster all faces in an event into "people"; browse by person.
- Filters: date range, uploader, album, favorites, file type.
- "Find more of this person" from any photo.
- Combine face + filters (e.g. "me, at the reception album, on Saturday").

### 3.7 Sharing & permissions
- Shareable links at event / album / photo / **person** level.
- Link controls: expiry, password, view-only vs. allow-download, disable after N views.
- Roles: co-organizer (manage), photographer (upload), attendee (view own), public viewer.
- Attendee "my photos" shareable link (their face results).
- Watermarked previews option (even for a free product, protects photographers).

### 3.8 Download
- Single, multi-select, "download all my photos" (zip — already have archiver).
- Original vs. web-optimized choice.
- Background zip generation for large sets + download-ready notification.

### 3.9 Trash, quotas & lifecycle
- Soft-delete → 30-day trash → restore or purge.
- Per-organizer storage quota + usage meter; per-event limits.
- *(No event auto-expiry — user decision. Storage is controlled via compression + quotas +
  manual deletion instead.)*

### 3.10 Notifications
- "Your photos are ready" (attendee, after processing).
- "New photos added to your event" (attendee opt-in).
- "Upload complete / processing done" (photographer).
- Email (transactional) + optional web push (PWA).

### 3.11 Admin, analytics & activity
- Organizer dashboard: events, storage used, attendees, downloads, top photos.
- Activity log: views, downloads, shares, by whom.
- Platform admin: abuse reports, storage, user management.

### 3.12 Trust, privacy & safety (non-negotiable — we process biometrics)
- **Consent flow** before selfie/face processing (explicit opt-in).
- **"Delete my face data"** + full account/data deletion (GDPR/CCPA style).
- Retention policy: auto-purge embeddings + selfies after event ends.
- Clear privacy policy + terms; data-processing disclosure.
- Rate limiting, abuse prevention, content moderation hooks (NSFW/illegal).
- Selfies used only for matching, never stored long-term / never shared.

### 3.13 Platform & clients
- Responsive web app (primary).
- **PWA** (installable, mobile-first, optional offline cache) — replaces native apps for now.
- Public event landing pages + **QR codes** for on-site attendee onboarding.

---

## 4. Cross-cutting: scale (large events) & the "free" model

You chose **large events** + **free for users**. Those two pull against each other on cost, so
this is designed in from the start:

- **Free for *users* ≠ free to *operate*.** Face compute + storage + egress cost the operator.
  Levers to keep it sustainable: aggressive ingest compression, event auto-expiry, storage
  quotas, batched/queued face processing, and R2 (zero egress fees).
- **Large-event readiness:** horizontal worker scaling, queue backpressure, paginated
  everything, CDN in front of derivatives, DB read replicas for gallery reads, HNSW index tuning
  as vectors grow into the millions.
- **Face-grouping at scale:** clustering thousands of faces per event needs an efficient
  approach (approximate clustering over pgvector, incremental as photos arrive).

*(If the free model ever needs a backstop, the natural, non-intrusive option is watermarked
previews with optional paid hi-res — kept out of scope for now per your call, but the schema
should not preclude it.)*

---

## 5. Phased roadmap

Built in order; each phase ships something usable.

**Phase 1 — Harden the core (current) ✅ mostly done**
Selfie search accuracy (`buffalo_l`), thumbnails, performance, production build.

**Phase 2 — Structure & sharing**
**Dual-section attendee gallery (All photos + persistent My photos)** and **Google Photos-style
lightbox (zoom/pan/keyboard-nav)** — *building now*. Then: albums/hierarchy, video support, HEIC
ingest + compression, bulk/resumable upload, share links with permissions, event landing pages
+ QR.

**Phase 3 — Intelligence & organization**
Auto face-grouping ("people"), advanced search/filters, favorites/tags, trash + restore,
storage quotas, notifications, optional attendee accounts.

**Phase 4 — Collaboration & insight**
Co-organizers/teams, comments/reactions, activity log, analytics dashboard, watermarking.

**Phase 5 — Reach & polish**
PWA + offline, mobile capture polish, OAuth sign-in, admin/moderation console,
internationalization.

**Cross-cutting, starts in Phase 2 and never stops:** Trust & Privacy (§3.12) — consent, data
deletion, retention. We do not add real biometric users at scale without it.

---

## 6. Explicitly OUT of scope (and why)

- **Real-time collaborative document editing (Docs/Sheets/Slides)** — enormous, unrelated to
  events/media. This is the bulk of what makes Drive "Drive" and we are deliberately not it.
- **Arbitrary file storage** (PDFs, zips, code) — we are a *media* platform, not a file locker.
- **Native desktop/mobile sync clients** — a PWA covers mobile; native sync is a huge
  maintenance surface for little event value.
- **Version history** — photos are immutable; re-upload replaces.
- **OCR / document content search** — irrelevant to event photos.

Keeping these out is what makes "build the whole thing" actually achievable.

---

## 7. Technical implications (high level)

- **Schema growth:** albums (hierarchy), videos, tags, favorites, share-links, permissions,
  face-clusters/persons, trash flags, quotas, activity events, notifications, attendee accounts.
- **New/expanded services:** video frame sampling in the worker; a clustering job; an email/
  notification service; a zip-generation job; a moderation hook.
- **Storage:** derivative pipeline (thumb / web / original), lifecycle + expiry rules, CDN.
- **Scale:** worker autoscaling, queue backpressure, paginated/virtualized galleries, HNSW
  tuning, read replicas.
- **Privacy:** consent records, retention/purge jobs, data-export + delete endpoints.

---

## 8. Decisions (locked)

1. **Attendee accounts:** ✅ optional accounts, added in Phase 3 (enables cross-event "my
   photos" + notifications).
2. **Videos:** ✅ photos-first; video added in Phase 2.
3. **Watermarking:** ✅ build it (protects photographers, cheap).
4. **Event auto-expiry:** ❌ **No** — storage controlled via compression + quotas + manual
   deletion, not expiry.
5. **Dual-section attendee gallery** (All photos + persistent My photos) and **Google
   Photos/Drive-style lightbox**: ✅ locked, being built now (see §3.5 / §3.5a).

**Still open:** hosting budget ceiling for the free product at large scale — sets how aggressive
compression/quota defaults must be. Can be decided later; doesn't block building.

---

*Next step once this scope is agreed: turn Phase 2 into an atomic, sequential TODO (same style
as the original build) and start executing.*
