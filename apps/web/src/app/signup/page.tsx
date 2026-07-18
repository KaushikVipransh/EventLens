'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError, orgToken } from '@/lib/api';
import { Card, GradientBlob, Nav, PillButton } from '@/components/ui';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.signup(form);
      orgToken.set(token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <GradientBlob className="right-[-10%] top-[-5%] h-96 w-96" color="#8B6FD9" />
      <Nav />
      <div className="relative z-10 mx-auto mt-8 max-w-md px-6">
        <Card>
          <h1 className="text-h2 font-semibold">Create your studio account</h1>
          <p className="mt-1 text-sm text-ink/60">Start centralizing your event photos.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Studio / your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              hint="At least 8 characters"
            />
            {error && <p className="text-sm text-coral">{error}</p>}
            <PillButton type="submit" disabled={busy} className="w-full">
              {busy ? 'Creating…' : 'Create account'}
            </PillButton>
          </form>
          <p className="mt-4 text-center text-sm text-ink/60">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-ink underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-xl border border-ink/15 bg-cream-light px-4 py-2.5 text-sm outline-none focus:border-ink/40"
      />
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
