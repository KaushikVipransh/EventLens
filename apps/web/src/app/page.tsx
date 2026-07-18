import { Card, GradientBlob, Nav, PillLink, Sparkle } from '@/components/ui';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <GradientBlob className="left-[-10%] top-[-5%] h-[420px] w-[420px]" color="#F0997B" />
      <GradientBlob className="right-[-8%] top-[10%] h-[380px] w-[380px]" color="#8B6FD9" />
      <GradientBlob className="bottom-[-10%] left-[30%] h-[360px] w-[360px]" color="#6FA8E8" />

      <Nav />

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
        <div className="mx-auto max-w-3xl rounded-card bg-panel/80 p-10 text-center shadow-lift backdrop-blur-sm md:p-16">
          <span className="mb-5 inline-flex items-center gap-2 rounded-pill bg-cream px-4 py-1.5 text-xs font-medium">
            <span className="text-amber">
              <Sparkle className="h-4 w-4" />
            </span>
            event photos, self-serve
          </span>

          <h1 className="text-display lowercase tracking-tight">
            find yourself in <span className="text-coral">every photo</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink/70">
            Organizers centralize photos from every photographer in one event space. Guests find
            their own photos in seconds with a selfie — then download them, no waiting.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <PillLink href="/signup">Create an event</PillLink>
            <PillLink href="/join" variant="secondary">
              I have an event code
            </PillLink>
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
          {[
            { c: '#4C9A5B', t: 'One event space', d: 'Every photographer uploads into a single shared pool.' },
            { c: '#3A7BD5', t: 'Find my photos', d: 'A selfie matches your face across the whole gallery.' },
            { c: '#E8623A', t: 'Download instantly', d: 'Grab your matches individually or all at once.' },
          ].map((f) => (
            <Card key={f.t} className="text-left">
              <span
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-white"
                style={{ background: f.c }}
              >
                <Sparkle className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-ink/70">{f.d}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
