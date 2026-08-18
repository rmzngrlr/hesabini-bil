import { useRef, useState } from 'react';
import type { ReactNode, PointerEvent as RPE, KeyboardEvent as RKE } from 'react';
import { useNavigate } from 'react-router-dom';

interface SwipeNavCardProps {
  to: string;
  icon: ReactNode;
  /** Reveal şeridinin arka planı + ikon rengi (Tailwind sınıfları). */
  revealClassName?: string;
  /** navigate'ten hemen önce (örn. hedef sekmeyi sessionStorage'a yaz). */
  beforeNavigate?: () => void;
  children: ReactNode;
}

const MAX = 96;        // en fazla sola kayma (px)
const THRESHOLD = 56;  // bu kadar kayıp bırakılırsa git
const SLOP = 6;        // eksen kararı / tık eşiği

// Bilanço özet kartını sarar: TIK -> git, SOLA KAYDIR -> altından ikon çıkar,
// eşiği geçip bırakınca git, geçmezse geri yaslan. Dikey scroll'la çakışmasın
// diye touch-action: pan-y + ilk harekette eksen (yatay/dikey) tespiti.
export function SwipeNavCard({ to, icon, revealClassName = 'bg-secondary/70 text-foreground', beforeNavigate, children }: SwipeNavCardProps) {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'h' | 'v' | null>(null);
  const offsetRef = useRef(0);

  const go = () => { beforeNavigate?.(); navigate(to); };

  const setOff = (v: number) => { offsetRef.current = v; setOffset(v); };
  const reset = () => { startRef.current = null; axisRef.current = null; setDragging(false); setOff(0); };

  const onPointerDown = (e: RPE<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = null;
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
      setOff(Math.max(-MAX, Math.min(0, dx))); // yalnız sola
    }
  };

  const onPointerUp = () => {
    const decided = axisRef.current;
    const off = offsetRef.current;
    reset();
    if (decided === null) go();                          // neredeyse hareketsiz -> tık
    else if (decided === 'h' && -off >= THRESHOLD) go(); // eşiği geçen sola-kaydırma
    // aksi halde geri yaslan (offset zaten 0)
  };

  const onKeyDown = (e: RKE<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative h-full overflow-hidden rounded-xl outline-none cursor-pointer select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
      onKeyDown={onKeyDown}
    >
      <div className={`absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden ${revealClassName}`} style={{ width: -offset }}>
        <div className="flex w-24 items-center justify-center">{icon}</div>
      </div>
      <div className="h-full" style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}>
        {children}
      </div>
    </div>
  );
}
