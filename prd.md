# Product Requirements Document (PRD)
## Event Photo Retrieval Platform (Working Title: EventLens)

---

## 1. Overview

A web platform that lets event organizers (weddings, conferences, corporate events) centralize all event photography in one place, and lets attendees instantly find and download their own photos using facial recognition — without manually searching through thousands of images or waiting for someone to email them files.

---

## 2. Problem Statement

At most events with professional photography, photos end up scattered:
- Multiple photographers (often 5–10+ at a wedding) each hold their own batch of photos.
- Organizers manually collect, sort, and distribute photos to guests — often taking days or weeks.
- Guests have no self-serve way to find just their own photos among thousands.
- Generic tools (Google Drive, Google Photos) are built for personal libraries, not multi-contributor event coordination with guest-facing self-service search.

---

## 3. Goals

- Let organizers centralize photos from multiple photographers into a single event space.
- Let attendees find their own photos in under a minute using a selfie, without organizer intervention.
- Let attendees browse the full event gallery, not just their own matches.
- Prioritize an accurate, reliable core loop (find + download) over secondary features in the MVP.
- Keep initial infrastructure costs near zero while remaining architecturally ready to scale to paid infra as usage grows.

### Non-Goals (for MVP)
- Social sharing/tagging features
- Photo editing or filters
- Real-time (sub-second) face search — a short processing/search latency is acceptable
- Advanced analytics dashboards for organizers

---

## 4. Target Users

**Primary personas:**

1. **Event Organizer / Studio Head** — runs or manages the event photography (e.g., wedding studio owner). Needs to onboard multiple photographers and distribute photos to guests with minimal manual work.
2. **Contributing Photographer** — one of several photographers shooting the same event. Needs a simple way to upload just their own batch of photos into the shared event pool.
3. **Event Attendee / Guest** — attends the event and wants to find and download only the photos they appear in, plus optionally browse everything.

---

## 5. User Stories

### Organizer
- As an organizer, I want to create an event space so all photos from the event live in one place.
- As an organizer, I want to invite multiple photographers with individual upload links so I don't have to collect and re-upload photos myself.
- As an organizer, I want to share a single event link/code with all attendees so they can access their photos.
- As an organizer, I want photo processing to happen automatically in the background so I don't have to manage it manually.

### Photographer
- As a photographer, I want to upload my batch of event photos directly using a link assigned to me, without needing full organizer access.
- As a photographer, I want confirmation that my photos were received and queued for processing.

### Attendee
- As an attendee, I want to enter an event code/link and browse all photos from the event.
- As an attendee, I want to take a selfie and have the system find all photos I appear in.
- As an attendee, I want to download the photos that match me, individually or in bulk.
- As an attendee, I want to know roughly how long it will take to get my results (so I'm not left wondering).

---

## 6. Feature List

### MVP (Phase 1) — Core Loop
1. **Event creation** (organizer) — name, date, generate shareable attendee link/code.
2. **Multi-photographer upload** — organizer generates per-photographer upload links; each photographer uploads directly into the shared event pool.
3. **Background processing pipeline** — face detection + embedding generation for every uploaded photo, run asynchronously so uploads aren't blocked.
4. **Attendee login via event code/link.**
5. **Full gallery browse** — attendees can scroll/browse all processed photos from the event.
6. **"Find My Photos"** — attendee captures a selfie via front camera; system matches their face embedding against stored event embeddings and returns matching photos.
7. **Download** — attendees can download individual photos or batch-download all their matches (priority feature, per our discussion).

### Phase 2 (Post-MVP, not built now)
- Favorites/starring photos
- Social sharing links
- Organizer tagging/categorization (ceremony, reception, etc.)
- Email/notification when processing completes
- Analytics for organizers (views, downloads per photo)

---

## 7. Key Flows (Recap)

**Organizer flow:** Create event → generate photographer upload links → generate attendee link/code → photos process in background → share attendee link.

**Photographer flow:** Receive upload link → log in/upload batch → confirmation.

**Attendee flow:** Enter event code → browse gallery OR tap "Find My Photos" → capture selfie → system returns matches (target: 10–30 seconds) → download matches.

---

## 8. Non-Functional Requirements

- **Accuracy is non-negotiable** — face matching must be reliably accurate across varied lighting, angles, and group/crowd photos. This drives the technical decision to use a dedicated, higher-accuracy face recognition pipeline rather than a lower-accuracy convenience library.
- **Latency targets:**
  - Bulk photo processing (upload → searchable): acceptable in the range of tens of minutes to a few hours depending on volume, given free-tier/CPU-based infra.
  - Attendee selfie search: target 10–30 seconds end-to-end.
- **Cost:** MVP should run on free-tier infrastructure at small scale (roughly 500–2,000 photos per event), with a clear, documented path to paid infrastructure (e.g., GPU inference) as volume grows.
- **Privacy/isolation:** each event's photos and face data must be isolated from other events (multi-tenancy).

---

## 9. Success Metrics

- **Search accuracy:** percentage of attendee selfie searches that return correct matches without false positives/negatives (target: high accuracy, to be measured via manual QA on test events before launch).
- **Time-to-result:** median time from selfie capture to returned matches (target: under 30 seconds).
- **Processing throughput:** time to fully process an event's photo set relative to photo count (tracked to know free-tier limits).
- **Adoption:** number of organizers who complete a full event cycle (create → upload → attendees retrieve photos).
- **Retention/usage:** percentage of attendees who use "Find My Photos" vs. only browsing.
- **Download completion:** percentage of attendees who successfully download at least one matched photo (core value delivered).

---

## 10. Constraints & Assumptions

- Built by a solo/small team, so architecture favors known, familiar tools (Node.js/Next.js) wherever accuracy isn't compromised.
- Free-tier infrastructure is acceptable for MVP/demo scale; the system is architected (real job queue, real vector search) so it doesn't need to be rebuilt when scaling to paid infra.
- Face recognition accuracy is prioritized over staying in a single-language stack — a dedicated Python microservice is acceptable if it meaningfully improves match accuracy.
