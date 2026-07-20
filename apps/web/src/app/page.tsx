'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Marquee, Reveal } from '@/components/motion';
import { GradientBlob, PillLink, Mark } from '@/components/ui';

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    n: '01',
    color: '#4C9A5B',
    title: 'photographers upload',
    body: 'Every photographer gets their own link and drops their batch into one shared event space — no collecting, no re-uploading.',
  },
  {
    n: '02',
    color: '#3A7BD5',
    title: 'guests take a selfie',
    body: 'Attendees open the event link, tap “find my photos”, and snap a selfie. Facial recognition scans the whole gallery in seconds.',
  },
  {
    n: '03',
    color: '#E8623A',
    title: 'download the matches',
    body: 'Every photo they appear in, ready to grab — one at a time or all at once as a zip. No waiting, no DMs, no email chains.',
  },
];

const FEATURES = [
  { color: '#8B6FD9', title: 'one event, one space', body: 'Five, ten, twenty photographers — all their photos land in a single gallery.', big: true },
  { color: '#3A7BD5', title: 'find my photos', body: 'A selfie is all it takes to surface every shot you’re in.' },
  { color: '#E8623A', title: 'instant download', body: 'Individually or the whole set as a zip — downloads are the priority.' },
  { color: '#4C9A5B', title: 'private by event', body: 'Each event’s photos and face data stay isolated from every other.' },
  { color: '#F0B429', title: 'any phone camera', body: 'Works right in the browser — no app to install, front camera and go.' },
];

const STATS = [
  { value: '< 30s', label: 'from selfie to your photos' },
  { value: '2,000+', label: 'photos per event, handled' },
  { value: '10+', label: 'photographers, one link' },
  { value: '0', label: 'apps to install' },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-ink/5 bg-cream/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold" data-hover>
            <span className="text-coral">
              <Mark />
            </span>
            eventlens
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#how" className="hover:opacity-60" data-hover>
              how it works
            </a>
            <a href="#features" className="hover:opacity-60" data-hover>
              features
            </a>
            <a href="#start" className="hover:opacity-60" data-hover>
              get started
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium hover:opacity-60" data-hover>
              Log in
            </Link>
            <PillLink href="/signup" className="py-2">
              Sign up
            </PillLink>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] items-center px-6">
        <GradientBlob className="left-[-12%] top-[-6%] h-[460px] w-[460px]" color="#F0997B" />
        <GradientBlob className="right-[-10%] top-[6%] h-[420px] w-[420px]" color="#8B6FD9" />
        <GradientBlob className="bottom-[-14%] left-[28%] h-[420px] w-[420px]" color="#6FA8E8" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center py-16 text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-6 inline-flex items-center gap-2 rounded-pill border border-ink/10 bg-panel/70 px-4 py-1.5 text-xs font-medium backdrop-blur"
          >
            <span className="text-amber">
              <Mark className="h-4 w-4" />
            </span>
            event photography, self-serve
          </motion.span>

          <h1 className="text-display lowercase tracking-tight">
            {['find', 'yourself', 'in'].map((w, i) => (
              <motion.span
                key={w}
                className="mr-3 inline-block"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE }}
              >
                {w}
              </motion.span>
            ))}
            <motion.span
              className="inline-block text-coral"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.34, ease: EASE }}
            >
              every photo
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-ink/70"
          >
            Centralize photos from every photographer at your event. Guests find their own shots
            with a single selfie — and download them in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62, ease: EASE }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <PillLink href="/signup">Create an event</PillLink>
            <PillLink href="/join" variant="secondary">
              I have an event code
            </PillLink>
          </motion.div>
        </div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-ink/40"
        >
          scroll
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            ↓
          </motion.span>
        </motion.div>
      </section>

      {/* ── Marquee ──────────────────────────────────────────────────────── */}
      <section className="border-y border-ink/10 bg-ink py-5 text-cream">
        <Marquee>
          {['find your photos', 'one selfie', 'every moment', 'zero waiting', 'download it all'].map(
            (t) => (
              <span key={t} className="flex items-center whitespace-nowrap px-6 text-2xl font-semibold lowercase md:text-3xl">
                {t}
                <span className="px-6 text-coral">
                  <Mark />
                </span>
              </span>
            ),
          )}
        </Marquee>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal>
          <p className="text-sm uppercase tracking-widest text-ink/40">how it works</p>
          <h2 className="mt-3 max-w-2xl text-h1 lowercase">
            three steps from camera roll to <span className="text-grass">your hands</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="group h-full rounded-card bg-panel p-8 shadow-lift transition-transform duration-300 hover:-translate-y-1" data-hover>
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
                  style={{ background: s.color }}
                >
                  {s.n}
                </div>
                <h3 className="mt-6 text-xl font-semibold lowercase">{s.title}</h3>
                <p className="mt-3 text-ink/65">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features bento ───────────────────────────────────────────────── */}
      <section id="features" className="relative bg-cream-light py-24 md:py-32">
        <GradientBlob className="right-[-6%] top-[10%] h-72 w-72" color="#F0997B" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-sm uppercase tracking-widest text-ink/40">features</p>
            <h2 className="mt-3 max-w-2xl text-h1 lowercase">
              everything an event needs, <span className="text-grape">nothing it doesn’t</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 3) * 0.1}
                className={f.big ? 'md:col-span-2 md:row-span-1' : ''}
              >
                <div className="group flex h-full flex-col rounded-card bg-panel p-8 shadow-lift transition-transform duration-300 hover:-translate-y-1" data-hover>
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white"
                    style={{ background: f.color }}
                  >
                    <Mark className="h-5 w-5" />
                  </span>
                  <h3 className="mt-6 text-xl font-semibold lowercase">{f.title}</h3>
                  <p className="mt-2 text-ink/65">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="grid grid-cols-2 gap-y-12 md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center">
              <div className="text-5xl font-semibold tracking-tight md:text-6xl">{s.value}</div>
              <p className="mx-auto mt-3 max-w-[12ch] text-sm text-ink/55">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section id="start" className="mx-auto max-w-6xl px-6 pb-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-20 text-center text-cream">
            <div className="gradient-blob left-[10%] top-[-20%] h-72 w-72" style={{ background: '#8B6FD9', opacity: 0.35 }} />
            <div className="gradient-blob right-[8%] bottom-[-30%] h-80 w-80" style={{ background: '#E8623A', opacity: 0.35 }} />
            <div className="relative z-10">
              <h2 className="mx-auto max-w-2xl text-h1 lowercase">
                ready to find yourself in every photo?
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-cream/70">
                Spin up an event in a minute. Your guests will thank you.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-pill bg-cream px-7 py-3 text-sm font-medium text-ink transition hover:bg-white"
                  data-hover
                >
                  Create an event
                </Link>
                <Link
                  href="/join"
                  className="inline-flex items-center gap-2 rounded-pill border border-cream/30 px-7 py-3 text-sm font-medium text-cream transition hover:bg-cream/10"
                  data-hover
                >
                  I have a code
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-ink/50 md:flex-row">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span className="text-coral">
              <Mark className="h-4 w-4" />
            </span>
            eventlens
          </span>
          <span>find yourself in every photo.</span>
          <span>© {new Date().getFullYear()} EventLens</span>
        </div>
      </footer>
    </main>
  );
}
