# EventLens — Build Plan (Atomic Task List)

Each task is **atomic** (one concern), **sequential** (no overlapping dependencies), and must be
**verified green** (build + test/smoke passes) before the next task begins.

## Key technical decisions (local-first, zero-cost, fully automatable)
The PRD/techstack picked production hosts (Vercel, Upstash, Supabase, R2, Clerk). For a fully
automated local build with no external accounts, we use **drop-in, API-compatible equivalents**
that swap to the production services later via env vars only:

| Concern | Production (techstack.md) | Local dev equivalent (this build) |
|---|---|---|
| Postgres + pgvector | Supabase/Neon | `pgvector/pgvector` Docker image |
| Redis (BullMQ) | Upstash | `redis` Docker image |
| Photo storage (S3 API) | Cloudflare R2 | MinIO Docker (S3-compatible) |
| Organizer/photographer auth | Clerk | Auth.js-style JWT (own endpoints) — no external account |
| Face recognition | ArcFace/RetinaFace | InsightFace `buffalo_l` (RetinaFace det + ArcFace embed) |

- **Monorepo:** npm workspaces. **ORM:** Drizzle (native `pgvector` support). **API:** Express + TS.
- **Frontend:** Next.js App Router + TypeScript + Tailwind.
- Everything runs via `docker compose up` + workspace scripts. Production swap = change `.env`.

---

## Phase 0 — Foundation & local infrastructure
- [ ] 0.1 — Init git repo; add root `.gitignore`, `.editorconfig`, `README` stub.
- [ ] 0.2 — Monorepo layout + root `package.json` (npm workspaces): `apps/{web,api,worker}`, `services/face`, `packages/{shared,db,queue}`.
- [ ] 0.3 — Root tooling: `tsconfig.base.json`, Prettier, ESLint flat config.
- [ ] 0.4 — `docker-compose.yml` (Postgres+pgvector, Redis, MinIO) + `.env.example`; verify all containers healthy.

## Phase 1 — Shared types & database
- [ ] 1.1 — `packages/shared`: shared TS types + zod schemas (Event, Photographer, Photo, Face, Search).
- [ ] 1.2 — `packages/db`: Drizzle client + config, connect to Docker Postgres.
- [ ] 1.3 — Schema: `organizers`, `events`.
- [ ] 1.4 — Schema: `photographers`, `upload_links`.
- [ ] 1.5 — Schema: `photos` (+ status enum).
- [ ] 1.6 — Schema: `faces` with `vector(512)` embedding + HNSW cosine index.
- [ ] 1.7 — Generate + run migrations; verify tables & vector index exist in DB.
- [ ] 1.8 — Seed script (demo organizer + event).

## Phase 2 — API foundation
- [ ] 2.1 — `apps/api` Express+TS skeleton, `/health`, zod-validated env config loader.
- [ ] 2.2 — pino logging + central error handler + async route + validation helpers.
- [ ] 2.3 — Wire `packages/db` into API; `/health/db` checks DB connectivity.
- [ ] 2.4 — S3 client (AWS SDK v3) → MinIO; bucket bootstrap; presigned URL helper + test.

## Phase 3 — Auth
- [ ] 3.1 — Organizer signup/login (bcrypt + JWT); `/auth` routes.
- [ ] 3.2 — Organizer auth middleware + role guard.
- [ ] 3.3 — Attendee event-code → signed short-lived JWT; verify middleware.
- [ ] 3.4 — Photographer upload-link scoped token; verify middleware.

## Phase 4 — Event & link management
- [ ] 4.1 — `POST /events`, `GET /events`, `GET /events/:id` (organizer-scoped).
- [ ] 4.2 — `POST /events/:id/photographers` → generates per-photographer upload link.
- [ ] 4.3 — `GET /events/:id/attendee-link` → attendee code/link.

## Phase 5 — Upload pipeline
- [ ] 5.1 — `POST /uploads/presign` (photographer-token scoped) → presigned PUT URLs.
- [ ] 5.2 — `POST /uploads/complete` → persist photo rows.
- [ ] 5.3 — Enqueue one processing job per uploaded photo.

## Phase 6 — Queue & worker
- [ ] 6.1 — `packages/queue`: BullMQ connection + `photo-processing` queue.
- [ ] 6.2 — `apps/worker` skeleton consuming queue; retry/backoff.
- [ ] 6.3 — Worker: fetch photo from storage → call face service → store faces+embeddings.
- [ ] 6.4 — Worker: photo status transitions + failed-job handling; verify end-to-end enqueue→process.

## Phase 7 — Python face service
- [ ] 7.1 — `services/face` FastAPI skeleton + `/health`.
- [ ] 7.2 — Load InsightFace `buffalo_l` on startup.
- [ ] 7.3 — `POST /detect-embed`: image → `[{bbox, embedding[512], det_score}]`.
- [ ] 7.4 — Dockerfile + compose wiring; verify Node→Python call returns embeddings.

## Phase 8 — Search, gallery, download
- [ ] 8.1 — `GET /events/:id/photos` paginated gallery (attendee-auth).
- [ ] 8.2 — `POST /events/:id/search` selfie → embed → pgvector cosine search → matches.
- [ ] 8.3 — `GET /photos/:id/download` single (presigned/stream).
- [ ] 8.4 — `POST /events/:id/download-batch` → zip stream of matched photos.

## Phase 9 — Frontend foundation
- [ ] 9.1 — `apps/web` Next.js App Router + TS; typed API client.
- [ ] 9.2 — Design system: Tailwind palette + fonts + global cream canvas per design.md.
- [ ] 9.3 — Core components: PillButton, Card, Chip, Toggle, GradientBlob, Nav.
- [ ] 9.4 — Landing page (hero + headline + CTA).

## Phase 10 — Frontend flows
- [ ] 10.1 — Organizer signup/login pages.
- [ ] 10.2 — Organizer dashboard: create event.
- [ ] 10.3 — Event detail: photographer link chips (copy) + attendee link.
- [ ] 10.4 — Photographer upload page (link-scoped) with progress + confirmation.
- [ ] 10.5 — Attendee entry (event code) page.
- [ ] 10.6 — Attendee gallery grid (hover download + "Find my photos" pill).
- [ ] 10.7 — Selfie capture flow (`getUserMedia` viewfinder).
- [ ] 10.8 — Find-my-photos results + processing state + single/batch download.

## Phase 11 — Integration, testing, docs
- [ ] 11.1 — Automated E2E happy-path script (seed → upload samples → process → search → download).
- [ ] 11.2 — Unit/integration tests per app + root `test` script.
- [ ] 11.3 — Full README: local run, env docs, production-swap + scale notes.
