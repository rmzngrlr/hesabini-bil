import { useRef, useState } from 'react';
import type { ReactNode, PointerEvent as RPE } from 'react';

const MAX = 96;        // en fazla sola reveal (px)
const SLOP = 6;        // eksen (yatay/dikey) karar esigi
const THRESHOLD = 48;  // bu kadar yatay kaydirip birakinca islem

/**
 * Kalan TL <-> Reel TL kart cevirici + sola-kaydir navigasyonu. Yon + hangi yuzde
 * olduguna gore karar verir:
 *   - Kalan (on) yuz: SOLDAN SAGA -> Reel'e cevir; SAGDAN SOLA -> onNavigate (reveal + git).
 *   - Reel (arka) yuz: SAGDAN SOLA -> Kalan'a geri cevir; saga bir sey yapmaz.
 * Dikey scroll ile cakismamak icin touch-action: pan-y + ilk harekette eksen tespiti.
 */
export function FlipCard({ front, back, onNavigate, navIcon, navRevealClassName = 'text-foreground' }: {
  front: ReactNode;
  back: ReactNode;
  onNavigate?: () => void;
  navIcon?: ReactNode;
  navRevealClassName?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState(0);     // yalniz ON-yuzde sola reveal
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'h' | 'v' | null>(null);
  const dxRef = useRef(0);
  const flippedRef = useRef(false);

  const reset = () => {
    startRef.current = null;
    axisRef.current = null;
    dxRef.current = 0;
    setDragging(false);
    setOffset(0);
  };

  const onPointerDown = (e: RPE<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    dxRef.current = 0;
    flippedRef.current = flipped;
    setDragging(true);
  };
  const onPointerMove = (e: RPE<HTMLDivElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (axisRef.current === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      axisRef.current = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      if (axisRef.current === 'h') {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* yok say */ }
      }
    }
    if (axisRef.current === 'h') {
      dxRef.current = dx;
      // Reveal (navigasyon ipucu) YALNIZ on-yuzde SOLA kaydirirken.
      if (!flippedRef.current && dx < 0) setOffset(Math.max(-MAX, dx));
      else setOffset(0);
    }
  };
  const onPointerUp = () => {
    const dx = dxRef.current;
    const axis = axisRef.current;
    const wasFlipped = flippedRef.current;
    reset();
    if (axis !== 'h') return;
    if (!wasFlipped) {
      if (dx >= THRESHOLD) setFlipped(true);       // soldan saga -> Reel
      else if (dx <= -THRESHOLD) onNavigate?.();    // sagdan sola -> Islemler
    } else {
      if (dx <= -THRESHOLD) setFlipped(false);      // sagdan sola -> Kalan
    }
  };

  return (
    <div
      className="relative h-full select-none overflow-hidden rounded-xl"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Sola-kaydir reveal seridi (altta, icerik sola kayinca gorunur) */}
      {offset < 0 && (
        <div className={`absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden ${navRevealClassName}`} style={{ width: -offset }}>
          <div className="flex w-24 items-center justify-center">{navIcon}</div>
        </div>
      )}
      {/* Kaydirma (translateX) + 3B cevirme (rotateY): perspective bu sarmalayicida,
          preserve-3d ice divde (overflow bu elemanlarda YOK -> 3B korunur). */}
      <div
        className="relative h-full"
        style={{ perspective: '1200px', transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.5s' }}
      >
        <div
          className="relative h-full"
          style={{ transformStyle: 'preserve-3d', transition: dragging ? 'none' : 'transform 0.5s', transform: `rotateY(${flipped ? 180 : 0}deg)` }}
        >
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>{front}</div>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>{back}</div>
        </div>
      </div>
      {/* iki-nokta ipucu: aktif yuz vurgulu */}
      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex gap-1">
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${!flipped ? 'bg-foreground/70' : 'bg-foreground/25'}`} />
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${flipped ? 'bg-foreground/70' : 'bg-foreground/25'}`} />
      </div>
    </div>
  );
}
