# EventLens

Event photo retrieval platform — organizers centralize multi-photographer event photos; attendees
find their own photos via a selfie (facial recognition) and download them.

Spec: [prd.md](prd.md) · [design.md](design.md) · [techstack.md](techstack.md) · build plan: [TODO.md](TODO.md)

## Architecture

```
apps/web       Next.js (App Router) frontend            → :3001
apps/api       Express + TypeScript main API            → :4000
apps/worker    BullMQ worker (photo processing)
services/face  FastAPI + InsightFace (detect + embed)   → :8000
packages/shared  shared types + zod schemas
packages/db      Drizzle schema + client (Postgres + pgvector)
packages/queue   BullMQ queue definitions
```

**Flow:** photographer uploads → API stores photo in object storage + enqueues a job → worker
fetches the image, calls the face service (RetinaFace detect + ArcFace embed), stores 512-d
embeddings in `pgvector` → attendee submits a selfie → API embeds it and runs a cosine-distance
nearest-neighbour search over that event's faces → matches returned and downloaded.

## Local vs. production

Built local-first with drop-in, API-compatible equivalents for the production hosts named in
`techstack.md`. Switching to production is an env change, not a code change:

| Concern | Local (Docker) | Production |
|---|---|---|
| Postgres + pgvector | `pgvector/pgvector` | Supabase / Neon |
| Redis (BullMQ) | `redis` | Upstash |
| Object storage (S3 API) | MinIO | Cloudflare R2 |
| Face recognition | InsightFace `buffalo_l` (FastAPI) | same, on Render/Railway (GPU optional) |
| Organizer auth | JWT (bcrypt) | Clerk / Auth.js (swap `/auth` routes) |

## Prerequisites

Node ≥ 20, Docker Desktop, and (only to build the face image) nothing else — it's containerized.

> On this machine Postgres is mapped to host port **5433** (5432 was taken). See `.env.example`.

## Quick start

```bash
cp .env.example .env
docker compose up -d            # postgres, redis, minio, face (first build compiles InsightFace)
npm install
npm run db:migrate
npm run db:seed                 # demo organizer: demo@eventlens.test / password123

# three processes (separate terminals):
npm run dev:api                 # http://localhost:4000
npm run dev:worker
npm run dev:web                 # http://localhost:3001
```

Then open http://localhost:3001.

## End-to-end test

With infra + api + worker + face running:

```bash
npm run e2e -- path/to/a-face-photo.jpg
```

It logs in, creates an event, uploads the photo, waits for processing, runs a selfie search with
the same face, asserts a match, and downloads the results as a zip.

## Low-RAM machines (≤ 8 GB)

The default `buffalo_l` model needs ~1.5–2 GB to load and a fast CPU. On memory-limited machines
(and with Docker Desktop **Resource Saver** on, which throttles the VM) it will OOM-kill (exit 137)
or run inference very slowly. Use the lighter settings in `.env` — verified working on 8 GB:

```
FACE_MODEL=buffalo_s     # MobileFaceNet — small download, ~10× less RAM
FACE_DET_SIZE=320        # smaller detection input → ~4× faster inference
```

Also turn **off** Docker Desktop → Settings → Resources → Resource Saver. `buffalo_l` remains the
accuracy default for capable hardware / production.

## Tuning face matching

`FACE_MATCH_THRESHOLD` (default `0.42`) is the maximum cosine distance for a face to count as a
match — lower is stricter. Tune per QA on real event sets; ArcFace normed embeddings typically
separate same/different identities well around this range.

## Scale notes

Comfortable at ~500–2,000 photos/event on free-tier/CPU infra (processing: tens of minutes to a
couple of hours). Scale path: GPU inference for the face service, dedicated vector DB (e.g. Qdrant)
if `pgvector` recall/latency becomes the bottleneck, and paid Postgres/Redis/storage tiers.
