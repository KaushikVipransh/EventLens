'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface LightboxItem {
  id: string;
  filename: string;
  url: string;
  fullUrl: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View {
  scale: number;
  tx: number;
  ty: number;
}
const RESET: View = { scale: 1, tx: 0, ty: 0 };

/**
 * Full-screen photo viewer modelled on Google Photos / Drive: open, zoom
 * (wheel · buttons · double-click · pinch) toward the cursor, pan when zoomed,
 * next/prev (arrow keys · on-screen chevrons), Esc/backdrop to close, download.
 */
export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
  token,
  onDownload,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
  token: string | null;
  /** Custom download handler; when omitted, falls back to the attendee endpoint
   *  (requires `token`). Pass this for share/other contexts. */
  onDownload?: (item: LightboxItem) => void;
}) {
  const [view, setView] = useState<View>(RESET);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);

  const item = items[index];
  const zoomed = view.scale > 1;

  // Reset zoom/pan whenever we move to a different photo. If the new image is
  // already cached, onLoad won't fire — detect .complete so it stays visible.
  useEffect(() => {
    setView(RESET);
    setLoaded(imgRef.current?.complete ?? false);
  }, [index]);

  const go = useCallback(
    (dir: number) => {
      const next = index + dir;
      if (next >= 0 && next < items.length) onNavigate(next);
    },
    [index, items.length, onNavigate],
  );

  // Zoom toward a screen point, keeping the image point under it fixed.
  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    setView((v) => {
      const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      if (ns === v.scale) return v;
      if (ns === 1) return RESET;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return v;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const k = ns / v.scale;
      return {
        scale: ns,
        tx: v.tx + (clientX - cx - v.tx) * (1 - k),
        ty: v.ty + (clientY - cy - v.ty) * (1 - k),
      };
    });
  }, []);

  // Keyboard: Esc close · arrows navigate · +/- zoom.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4);
      } else if (e.key === '-' || e.key === '_') {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.4);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, zoomAt]);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  function onDoubleClick(e: React.MouseEvent) {
    zoomAt(e.clientX, e.clientY, zoomed ? 1 / view.scale : 2.5);
  }

  // Single-pointer drag to pan (only meaningful when zoomed).
  function onPointerDown(e: React.PointerEvent) {
    if (!zoomed || pinchRef.current) return;
    dragRef.current = { x: e.clientX - view.tx, y: e.clientY - view.ty };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || pinchRef.current) return;
    setView((v) => ({ ...v, tx: e.clientX - dragRef.current!.x, ty: e.clientY - dragRef.current!.y }));
  }
  function endDrag() {
    dragRef.current = null;
  }

  // Two-finger pinch zoom.
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches) };
      dragRef.current = null;
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = touchDist(e.touches);
      const mid = touchMid(e.touches);
      zoomAt(mid.x, mid.y, dist / pinchRef.current.dist);
      pinchRef.current.dist = dist;
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.filename}
    >
      {/* Top toolbar */}
      <div className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 text-white/90">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.filename}</p>
          <p className="text-xs text-white/50">
            {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Zoom out"
            onClick={() => {
              const r = containerRef.current?.getBoundingClientRect();
              if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.4);
            }}
          >
            −
          </ToolbarButton>
          <ToolbarButton
            label="Zoom in"
            onClick={() => {
              const r = containerRef.current?.getBoundingClientRect();
              if (r) zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4);
            }}
          >
            +
          </ToolbarButton>
          {(onDownload || token) && (
            <ToolbarButton
              label="Download"
              onClick={() =>
                onDownload ? onDownload(item) : token && api.downloadPhoto(token, item.id, item.filename)
              }
            >
              ↓
            </ToolbarButton>
          )}
          <ToolbarButton label="Close" onClick={onClose}>
            ✕
          </ToolbarButton>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        // Click on empty backdrop (not the image) closes.
        onClick={(e) => {
          if (e.target === containerRef.current && !zoomed) onClose();
        }}
      >
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-white/40">Loading…</div>
        )}
        <div className="pointer-events-none absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={item.fullUrl}
            alt={item.filename}
            onLoad={() => setLoaded(true)}
            draggable={false}
            // h/w-full + object-contain => photo always scales to fill the
            // viewport while staying fully visible (letterboxed), like Google Photos.
            className="h-full w-full object-contain p-4"
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
              cursor: zoomed ? 'grab' : 'zoom-in',
              opacity: loaded ? 1 : 0,
              pointerEvents: 'auto',
              transition: dragRef.current ? 'none' : 'transform 120ms ease-out, opacity 200ms',
            }}
          />
        </div>

        {/* Prev / next */}
        {index > 0 && (
          <NavArrow side="left" onClick={() => go(-1)} />
        )}
        {index < items.length - 1 && (
          <NavArrow side="right" onClick={() => go(1)} />
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-hover
      className="grid h-10 w-10 place-items-center rounded-full text-lg text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function NavArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      onClick={onClick}
      data-hover
      className={`absolute top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white/90 backdrop-blur transition hover:bg-white/20 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  );
}

function touchDist(t: React.TouchList): number {
  const dx = t[0]!.clientX - t[1]!.clientX;
  const dy = t[0]!.clientY - t[1]!.clientY;
  return Math.hypot(dx, dy);
}
function touchMid(t: React.TouchList): { x: number; y: number } {
  return { x: (t[0]!.clientX + t[1]!.clientX) / 2, y: (t[0]!.clientY + t[1]!.clientY) / 2 };
}
