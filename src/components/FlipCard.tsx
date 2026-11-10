import { useRef, useState } from 'react';
import type { ReactNode, PointerEvent as RPE } from 'react';

const SLOP = 6;        // eksen (yatay/dikey) karar esigi
const THRESHOLD = 44;  // bu kadar yatay kaydirip birakinca cevir

/**
 * Yatay swipe ile on/arka yuzu 3B cevrilen kart (ör. Kalan TL <-> Reel TL).
 * Dikey scroll ile cakismamasi icin touch-action: pan-y + ilk harekette eksen
 * tespiti (SwipeNavCard ile ayni desen). Tiklama/dikey kaydirma cevirmez.
 */
export function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'h' | 'v' | null>(null);
  const passedRef = useRef(false);

  const onPointerDown = (e: RPE<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
    passedRef.current = false;
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
    if (axisRef.current === 'h' && Math.abs(dx) >= THRESHOLD) passedRef.current = true;
  };
  const onPointerUp = () => {
    if (axisRef.current === 'h' && passedRef.current) setFlipped(f => !f);
    startRef.current = null;
    axisRef.current = null;
    passedRef.current = false;
  };

  return (
    <div
      className="relative h-full select-none"
      style={{ perspective: '1200px', touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="relative h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>{front}</div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {back}
        </div>
      </div>
      {/* Cevrilebilir ipucu: iki nokta, aktif yuz vurgulu */}
      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex gap-1">
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${!flipped ? 'bg-foreground/70' : 'bg-foreground/25'}`} />
        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${flipped ? 'bg-foreground/70' : 'bg-foreground/25'}`} />
      </div>
    </div>
  );
}
