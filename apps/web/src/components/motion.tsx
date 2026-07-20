'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + rise into view once, on scroll. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Seamless infinite marquee row. */
export function Marquee({
  children,
  reverse = false,
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  className?: string;
}) {
  const anim = reverse ? 'animate-marquee-rev' : 'animate-marquee';
  return (
    <div className={`flex w-full overflow-hidden ${className ?? ''}`}>
      <div className={`flex min-w-full shrink-0 items-center ${anim}`}>{children}</div>
      <div className={`flex min-w-full shrink-0 items-center ${anim}`} aria-hidden>
        {children}
      </div>
    </div>
  );
}

/** Subtle vertical parallax for decorative elements. */
export function Parallax({
  children,
  strength = 60,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const yValue = useTransform(scrollYProgress, [0, 1], [strength, -strength]);
  return (
    <motion.div ref={ref} style={{ y: yValue }} className={className}>
      {children}
    </motion.div>
  );
}
