# Tech Stack Recommendation
## Event Photo Retrieval Platform

This document recommends a stack based on the PRD, optimized for: accuracy of face recognition, near-zero infrastructure cost at MVP scale, use of tools you're already comfortable with (Node.js/Next.js), and a clean path to scale later.

---

## 1. Frontend

**Recommendation: Next.js (React) + TypeScript**

- You've already built multiple projects in this stack (AuraPMS, Orbit, SharedFlood), so velocity will be highest here.
- Next.js gives you API routes for lightweight backend needs, image optimization out of the box (useful for a photo-heavy app), and easy deployment to free-tier hosts.
- Native browser camera access via `getUserMedia` for the selfie capture flow — no extra libraries needed.
- Server-side rendering helps the public gallery pages (shareable links) load fast and look polished, which matters for organizer-facing credibility.

---

## 2. Backend

**Recommendation: Node.js (Express) for the main API + a small dedicated Python microservice for face recognition only**

**Why split this way:**
- Per the PRD, accuracy of face detection/recognition is non-negotiable. The most accurate, industry-standard models (ArcFace, RetinaFace, FaceNet-style embeddings) are Python-native. Node-native alternatives like `face-api.js` are noticeably less accurate on varied lighting/angles/crowd photos — a real risk for a product whose core value is "we found the *right* photos of you."
- Everything else (event management, uploads, auth, gallery serving, orchestration) doesn't benefit from Python, and you already have strong working fluency in Node — so keeping that portion in Node maximizes your build speed and lowers the risk of unfamiliar-language bugs.
- The two communicate over a simple internal HTTP call: Node's job queue sends a photo to the Python service, gets back face crops + embeddings, and stores the result. This is a common, well-understood pattern (similar in spirit to the job-orchestration you already built in Orbit) — you're not becoming a Python developer, you're calling a specialized tool.

**Node responsibilities:** event/photographer/attendee management, photo upload endpoints, job orchestration, gallery API, search-matching orchestration, download endpoints.

**Python microservice responsibilities:** given a photo, return detected face bounding boxes + embeddings (using RetinaFace or MediaPipe for detection, ArcFace/FaceNet for embeddings). Stateless — no business logic, no database access.

---

## 3. Job Queue / Background Processing

**Recommendation: BullMQ (Redis-backed), with Redis hosted on Upstash (free tier)**

- BullMQ is the standard, battle-tested Node.js job queue — directly aligned with your existing Node comfort.
- This is the piece that fulfills the PRD's core non-functional requirement: photo uploads must not block on processing. Each uploaded photo becomes a queued job (detect → embed → store → cluster).
- Upstash's free tier is serverless Redis, which avoids needing to manage your own Redis instance and fits a free-tier-first MVP.
- Built-in retry/backoff and dead-letter handling directly reuse the same mental model you already implemented in Orbit's job scheduler — low new-concept overhead for you.

---

## 4. Database

**Recommendation: PostgreSQL with the `pgvector` extension, hosted on Supabase or Neon (free tier)**

- Standard relational data (events, organizers, photographers, attendees, photo metadata) fits naturally in Postgres.
- `pgvector` lets you store face embeddings directly alongside relational data and run similarity search (cosine distance) with a single database — no need to stand up and maintain a separate vector database for MVP scale, which keeps the stack simpler.
- Both Supabase and Neon offer genuinely usable free tiers for Postgres, satisfying the near-zero-cost MVP constraint while giving you a clear, well-documented upgrade path (paid tier, or migrate to a dedicated vector DB like Qdrant) if you outgrow it.

---

## 5. Authentication

**Recommendation: Clerk or Auth.js (NextAuth), with a lightweight event-code mechanism for attendees**

- **Organizers/Photographers** need real accounts with roles (organizer can create events and generate photographer links; photographers only get scoped upload access). Clerk or Auth.js both integrate cleanly with Next.js and support role-based access without much custom code.
- **Attendees** don't need full account creation for MVP — per the PRD's flow, they just need an event code/link to "log in" to a specific event's gallery. This can be a simple signed token/link (e.g., a short-lived JWT tied to the event ID) rather than full authentication, keeping friction low for guests while still isolating each event's data (multi-tenancy requirement from the PRD).
- This tiered approach avoids over-building auth for attendees, who are one-time, low-friction users, while still giving organizers/photographers proper account security.

---

## 6. Storage (Photos)

**Recommendation: Cloudflare R2 (free tier, 10GB)**

- S3-compatible API, so it works with standard Node/AWS SDK tooling without vendor lock-in if you migrate later.
- No egress fees on the free tier, which matters specifically for a photo-download-heavy product (per the PRD, download is the *priority* feature) — egress costs are where photo apps often get expensive.

---

## 7. Deployment

**Recommendation:**
- **Frontend + Node API:** Vercel (free tier) — native Next.js support, zero-config deploys, generous free tier for small-scale traffic.
- **Python face-recognition microservice:** Render or Railway free tier (Vercel doesn't run long-lived Python processes well) — deploy as a small containerized service that Node calls internally.
- **Redis (BullMQ):** Upstash free tier.
- **Postgres:** Supabase or Neon free tier.
- **Photo storage:** Cloudflare R2 free tier.

This spreads the stack across free tiers that are each individually reliable and well-documented, rather than forcing everything onto one provider's limits. The honest tradeoff (per our discussion): this comfortably handles roughly 500–2,000 photos per event and processing times of tens of minutes to a couple of hours — sufficient for a real small-to-mid-size event, with a clear, documented path to paid infra (GPU inference, dedicated vector DB, paid hosting tiers) once volume grows past that.

---

## 8. Summary Table

| Layer | Choice | Free Tier? |
|---|---|---|
| Frontend | Next.js + TypeScript | Yes (Vercel) |
| Main Backend API | Node.js / Express | Yes (Vercel) |
| Face Recognition | Python microservice (RetinaFace/MediaPipe + ArcFace/FaceNet) | Yes (Render/Railway) |
| Job Queue | BullMQ + Redis | Yes (Upstash) |
| Database | PostgreSQL + pgvector | Yes (Supabase/Neon) |
| Auth (Organizer/Photographer) | Clerk or Auth.js | Yes |
| Auth (Attendee) | Signed event-code link (no full account) | N/A |
| Photo Storage | Cloudflare R2 | Yes (10GB) |
