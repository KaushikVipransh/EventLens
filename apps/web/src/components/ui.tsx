'use client';

import Link from 'next/link';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

function cn(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ── Gradient blob (background atmosphere only) ────────────────────────────────
export function GradientBlob({
  className,
  color = '#F0997B',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={cn('gradient-blob', className)}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

// ── Pill button (solid black primary / outline secondary / accent) ────────────
type PillVariant = 'primary' | 'secondary' | 'accent';
const pillStyles: Record<PillVariant, string> = {
  primary: 'bg-ink text-white hover:bg-black',
  secondary: 'bg-transparent text-ink border border-ink hover:bg-ink/5',
  accent: 'bg-coral text-white hover:brightness-95',
};

const pillBase =
  'inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

export function PillButton({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: PillVariant }) {
  return (
    <button className={cn(pillBase, pillStyles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function PillLink({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(pillBase, pillStyles[variant], className)}>
      {children}
    </Link>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-card bg-panel p-6 shadow-lift', className)}>{children}</div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
export function Chip({
  color = '#4C9A5B',
  children,
}: {
  color?: string;
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center rounded-pill px-3 py-1 text-[13px] font-medium text-white"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({
  checked: controlled,
  onChange,
}: {
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const checked = controlled ?? internal;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange?.(!checked);
        setInternal(!checked);
      }}
      className={cn(
        'relative h-7 w-12 rounded-pill transition',
        checked ? 'bg-grass' : 'bg-ink/20',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white transition',
          checked ? 'left-6' : 'left-1',
        )}
      />
    </button>
  );
}

// ── Copy-to-clipboard button ──────────────────────────────────────────────────
export function CopyButton({ value, label = 'Copy link' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <PillButton
      variant="secondary"
      className="py-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied ✓' : label}
    </PillButton>
  );
}

// ── Sparkle accent ────────────────────────────────────────────────────────────
export function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

// ── Top navigation ────────────────────────────────────────────────────────────
export function Nav() {
  return (
    <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-coral">
          <Sparkle />
        </span>
        eventlens
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm font-medium hover:opacity-70">
          Log in
        </Link>
        <PillLink href="/signup" className="py-2">
          Sign up
        </PillLink>
      </div>
    </nav>
  );
}
