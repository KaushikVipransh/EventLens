'use client';

import { useEffect, useRef, useState } from 'react';
import { PillButton } from './ui';

/** Front-camera selfie capture. Calls onCapture with a JPEG blob. */
export function SelfieCapture({
  onCapture,
  onClose,
  busy,
}: {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Could not access the camera. Check browser permissions.'));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md rounded-card bg-panel p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Take a selfie</h3>
          <button onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-coral">{error}</p>
        ) : (
          <>
            <div className="mt-4 overflow-hidden rounded-card bg-cream">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[3/4] w-full -scale-x-100 object-cover"
              />
            </div>
            <p className="mt-3 text-center text-xs text-ink/50">
              Center your face and make sure it&apos;s well lit.
            </p>
            <PillButton onClick={capture} disabled={busy} className="mt-4 w-full">
              {busy ? 'Searching…' : 'Capture & find my photos'}
            </PillButton>
          </>
        )}
      </div>
    </div>
  );
}
