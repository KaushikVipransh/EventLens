# EventLens — Deployment Guide

EventLens is not a single app — it's **4 runtimes** and **3 stateful services**, so there is
no one-click deploy. This guide walks the whole thing, in order, on a stack chosen to be
cheap, reliable, and to get all the heavy compute **off your 8 GB laptop**.

## What has to run

| Component | What it is | Where we'll host it |
|-----------|-----------|---------------------|
| **web** | Next.js frontend | **Vercel** |
| **api** | Express REST API | **Railway** (Node service) |
| **worker** | BullMQ consumer (face pipeline + thumbnails) | **Railway** (Node service) |
| **face** | FastAPI + InsightFace (CPU, ~2 GB RAM) | **Railway** (Docker service) |
| **Postgres + pgvector** | database + vector search | **Railway** plugin (or Neon) |
| **Redis** | job queue | **Railway** plugin |
| **Object storage** | uploaded photos + thumbnails | **Cloudflare R2** |

**Why this stack:** Railway hosts a monorepo with both Node services *and* a Docker service,
plus managed Postgres/Redis, so almost everything lives in one project. R2 gives S3-compatible
storage with a generous free tier. Vercel is the natural home for Next.js.

**Cost reality:** the **face** service must stay warm (the model takes ~4 min to load on cold
start), so it can't sit on a free tier that sleeps. Budget roughly **$5–15/month** on Railway,
driven mostly by the face container's RAM. Everything else fits comfortably in free tiers.

---

## Phase 0 — Prerequisites (once)

1. Push the latest code to GitHub (already done: `KaushikVipransh/EventLens`).
2. Create free accounts: **Railway** (railway.app), **Cloudflare** (for R2), **Vercel**.
3. Install the Railway CLI (optional but handy):
   ```bash
   npm i -g @railway/cli
   railway login
   ```
4. Generate a strong JWT secret and keep it somewhere safe:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

---

## Phase 1 — Object storage (Cloudflare R2)

1. Cloudflare dashboard → **R2** → **Create bucket** → name it `eventlens-photos`.
2. **R2 → Manage API Tokens → Create API Token** → *Object Read & Write*, scoped to that
   bucket. Copy the **Access Key ID**, **Secret Access Key**, and your **Account ID**.
3. Your S3 endpoint is: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
4. Note these — you'll paste them into api + worker env in Phase 4:
   ```
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_ACCESS_KEY_ID=<r2 access key>
   S3_SECRET_ACCESS_KEY=<r2 secret>
   S3_BUCKET=eventlens-photos
   S3_FORCE_PATH_STYLE=true
   S3_PUBLIC_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```

> The app serves photos via **presigned URLs**, so you do **not** need to make the bucket
> public. The API auto-creates the bucket on boot, but since you've pre-created it that's a
> no-op.

---

## Phase 2 — Data services (Railway)

1. Railway → **New Project** → **Deploy from GitHub repo** → pick `EventLens`.
   (We'll add the individual services in Phase 3/4; first stand up the data plugins.)
2. In the project: **+ New → Database → Add PostgreSQL**.
3. In the project: **+ New → Database → Add Redis**.
4. **Enable pgvector** on the Postgres DB. Open the Postgres service → **Query** (or connect
   with `psql $DATABASE_URL`) and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
5. Copy the connection strings Railway generates:
   - Postgres → **`DATABASE_URL`** (use the `postgresql://…` value)
   - Redis → **`REDIS_URL`** (use the `redis://…` value)

> Railway's Redis already allows the `noeviction` policy BullMQ needs, and our queue client
> sets `maxRetriesPerRequest: null`, so no extra config is required.

---

## Phase 3 — Run the database migrations (once, before services boot)

From your laptop, point the migration at the **production** database and run it:

```bash
# PowerShell
$env:DATABASE_URL = "postgresql://…railway prod url…"
npm run db:migrate
```
```bash
# bash/git-bash
DATABASE_URL="postgresql://…railway prod url…" npm run db:migrate
```

This applies `0000_*` (tables + HNSW cosine index) and `0001_*` (thumb_storage_key column).

> Do **not** run `db:seed` against production — that's demo data.

---

## Phase 4 — Deploy the three compute services (Railway)

All three come from the **same repo**. In the Railway project, add a service for each and set
its **Root Directory / start command** and **variables** as below. For api + worker we run with
`tsx` (matches how the app actually runs and avoids monorepo build friction).

### 4a. `api` service
- **Source:** the GitHub repo (root of monorepo).
- **Build command:** `npm ci`
- **Start command:** `npx tsx apps/api/src/index.ts`
- **Networking:** enable a public domain (Railway → Settings → **Generate Domain**). Note it,
  e.g. `https://eventlens-api.up.railway.app`.
- **Variables:**
  ```
  NODE_ENV=production
  API_PORT=4000                 # Railway sets $PORT; see note below
  DATABASE_URL=<from Phase 2>
  REDIS_URL=<from Phase 2>
  JWT_SECRET=<from Phase 0>
  ATTENDEE_TOKEN_TTL=86400
  PHOTOGRAPHER_TOKEN_TTL=604800
  WEB_BASE_URL=<Vercel URL from Phase 5, set after you have it>
  API_BASE_URL=<this service's public URL>
  FACE_SERVICE_URL=<face service internal URL from 4c>
  FACE_MATCH_THRESHOLD=0.5
  S3_ENDPOINT=... S3_REGION=auto ... (all six S3_* vars from Phase 1)
  ```

### 4b. `worker` service
- **Source:** same repo.
- **Build command:** `npm ci`
- **Start command:** `npx tsx apps/worker/src/index.ts`
- **Networking:** none (no public domain — it's a background consumer).
- **Variables:** same `DATABASE_URL`, `REDIS_URL`, all `S3_*`, plus:
  ```
  FACE_SERVICE_URL=<face service internal URL from 4c>
  FACE_MATCH_THRESHOLD=0.5
  ```

### 4c. `face` service (Docker)
- **Source:** same repo, **Root Directory:** `services/face` (Railway auto-detects its
  `Dockerfile`).
- **Networking:** use Railway **private networking** so api/worker reach it internally, e.g.
  `http://face.railway.internal:8000`. Put that value into `FACE_SERVICE_URL` for api + worker.
- **Variables:**
  ```
  FACE_MODEL=buffalo_l          # full accuracy; needs ~2 GB RAM (see note)
  FACE_DET_SIZE=640
  ```
- **Resources:** give it enough memory for `buffalo_l` (≥ 2 GB). If you must run lean, set
  `FACE_MODEL=buffalo_s` — faster/lighter but less accurate (this is the accuracy ceiling we
  hit locally on 8 GB).
- **First boot** downloads the ~300 MB model; the healthcheck allows up to 240 s for that.

> **`$PORT` note:** Railway injects a `$PORT` env var. The API reads `API_PORT` and the face
> service reads a fixed `8000`/uvicorn port. Simplest path: expose the port each service
> already listens on (4000 for api, 8000 for face) via Railway's port settings, or set
> `API_PORT=$PORT`. Confirm the exposed port matches what the process binds.

---

## Phase 5 — Deploy the frontend (Vercel)

1. Vercel → **Add New → Project** → import `EventLens`.
2. **Root Directory:** `apps/web`.
3. Framework preset: **Next.js** (auto-detected). Build = `next build`, output handled by Vercel.
4. **Environment variable:**
   ```
   NEXT_PUBLIC_API_BASE_URL=https://<your api public URL from 4a>
   ```
5. Deploy. Copy the production URL, e.g. `https://eventlens.vercel.app`.

---

## Phase 6 — Wire the two URLs together

Now that both public URLs exist, close the loop:

1. **Railway `api` → variables →** set `WEB_BASE_URL=https://eventlens.vercel.app`
   (exact origin, no trailing slash). This is the **CORS allow-origin** — the API only accepts
   the browser from this one origin, and it's also used to build upload/attendee links.
2. Redeploy the `api` service so CORS picks up the new origin.
3. If you later add a custom domain on Vercel, update `WEB_BASE_URL` to that domain.

---

## Phase 7 — Smoke test production

1. `GET https://<api-url>/health` → `{ "status": "ok" }`.
2. Open the Vercel site → **Sign up** as an organizer (confirms API + DB + CORS + JWT).
3. Create an event → open the photographer upload link → upload a few photos.
4. Watch the Railway **worker** logs: each photo → thumbnail generated → face service called →
   faces stored. Confirm the **face** service logs show detections.
5. Open the attendee link → upload a selfie → confirm matching photos come back.
6. Download a photo (confirms presigned R2 GET works in the browser).

If search returns nothing: check `FACE_MATCH_THRESHOLD` (0.5 is our tuned value) and that the
worker actually finished processing (faces are written asynchronously).

---

## Environment variable reference (production)

| Var | api | worker | face | web | Source |
|-----|:--:|:--:|:--:|:--:|--------|
| `DATABASE_URL` | ✓ | ✓ | | | Railway Postgres |
| `REDIS_URL` | ✓ | ✓ | | | Railway Redis |
| `JWT_SECRET` | ✓ | | | | Phase 0 |
| `WEB_BASE_URL` | ✓ | | | | Vercel URL |
| `API_BASE_URL` | ✓ | | | | api public URL |
| `FACE_SERVICE_URL` | ✓ | ✓ | | | face internal URL |
| `FACE_MATCH_THRESHOLD` | ✓ | ✓ | | | `0.5` |
| `FACE_MODEL` / `FACE_DET_SIZE` | | | ✓ | | `buffalo_l` / `640` |
| `S3_*` (6 vars) | ✓ | ✓ | | | Cloudflare R2 |
| `NEXT_PUBLIC_API_BASE_URL` | | | | ✓ | api public URL |

---

## Alternatives & notes

- **Neon / Supabase** can replace Railway Postgres (both support pgvector — enable it in their
  dashboard, then run Phase 3 against their `DATABASE_URL`). Handy if you want DB and compute on
  different providers.
- **Render** works instead of Railway but its free tier **sleeps** services — brutal for the
  face model's 4-minute cold start. Use a paid instance for `face` if you go this route.
- **Fly.io** is a good fit for the face container (per-region VMs, scale-to-zero optional) if
  you want to split it out.
- **Cost lever:** the single biggest cost is keeping `face` warm with enough RAM. `buffalo_s`
  halves the footprint at some accuracy cost; `buffalo_l` is the quality option.
- **CORS is single-origin.** Vercel *preview* deployments have different URLs and will be
  blocked by the API. Test against the production Vercel URL (or add preview origins to the CORS
  config if you need them).
