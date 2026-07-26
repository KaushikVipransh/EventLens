'use client';

import { useEffect, useState } from 'react';
import QR from 'qrcode';

/** Renders a scannable QR for a URL (e.g. the attendee gallery link) with a
 *  download button — handy for printing/displaying on-site at an event. */
export function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) return;
    QR.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#17171A', light: '#FFFFFF' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-lg bg-cream"
        aria-hidden
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="QR code for the attendee link" width={size} height={size} className="rounded-lg" />
      <a
        href={dataUrl}
        download="eventlens-qr.png"
        data-hover
        className="text-xs font-medium text-ink/60 hover:text-ink"
      >
        Download QR
      </a>
    </div>
  );
}
