import type { ReactNode } from 'react';
import { useRef } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: ReactNode;
  value?: string | number;
  children?: ReactNode;
  className?: string;
  id?: string;
  // Açılır-kapanır kart: collapsible iken başlık tıklanabilir; open=false ise gövde gizlenir.
  // KAPALIYKEN dikkat çekici dolu (primary) bar; AÇIKKEN sade başlık. (Ekleme formları için.)
  collapsible?: boolean;
  open?: boolean;
  onToggleOpen?: () => void;
  // Mobilde: kart içindeki ilk input odaklanınca kartı BİR KEZ yukarı (başlık altına) sabitler;
  // sonraki odaklarda tarayıcının otomatik kaydırmasını geri alıp kartı oynatmaz. Odak karttan
  // tamamen çıkınca sıfırlanır. (Ekleme/düzenleme formları için.)
  pinOnFocus?: boolean;
}

// En yakın gerçek kaydırma kabını bul (uygulamada pencere değil, Layout'taki iç overflow div'i).
const getScroller = (el: HTMLElement | null): HTMLElement | null => {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
};

export function Card({ title, value, children, className, id, collapsible, open = true, onToggleOpen, pinOnFocus }: CardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const pinScrollTopRef = useRef<number | null>(null);

  const handleCardFocus = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!pinnedRef.current) {
      // İlk odak: kartı bir kez yukarı sabitle. Klavye + smooth kaydırma otursun, sonra
      // sabit konumu hafızaya al (sonraki odaklarda buraya geri çekeceğiz).
      pinnedRef.current = true;
      pinScrollTopRef.current = null;
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const scroller = getScroller(el);
        window.setTimeout(() => {
          pinScrollTopRef.current = scroller ? scroller.scrollTop : null;
        }, 450);
      });
    } else {
      // Zaten sabit: başka input'a geçişte tarayıcının otomatik kaydırmasını geri al.
      const scroller = getScroller(el);
      const target = pinScrollTopRef.current;
      if (!scroller || target == null) return;
      const restore = () => { if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target; };
      requestAnimationFrame(restore);
      window.setTimeout(restore, 90);
    }
  };

  const handleCardBlur = () => {
    // Odak karttan tamamen çıktıysa sıfırla (bir sonraki açılışta yeniden sabitlensin).
    window.setTimeout(() => {
      const el = rootRef.current;
      if (el && !el.contains(document.activeElement)) {
        pinnedRef.current = false;
        pinScrollTopRef.current = null;
      }
    }, 0);
  };
  // Kapalı (collapsible + !open): tüm kart, dikkat çekici dolu primary bir bar olur.
  if (collapsible && !open) {
    return (
      <button
        id={id}
        type="button"
        onClick={onToggleOpen}
        aria-expanded={false}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-4 py-3.5 hover:bg-primary/90 active:scale-[0.99] transition-all shadow-sm",
          className
        )}
      >
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Plus size={18} />
        </span>
        <span className="flex-1 text-left font-medium text-[15px]">{title}</span>
        <ChevronDown size={18} className="opacity-80 shrink-0" />
      </button>
    );
  }

  return (
    <div
      id={id}
      ref={rootRef}
      onFocus={pinOnFocus ? handleCardFocus : undefined}
      onBlur={pinOnFocus ? handleCardBlur : undefined}
      className={cn("p-4 rounded-xl glass", className)}
    >
      {title && (
        collapsible ? (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 text-left mb-1"
          >
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <ChevronUp size={18} className="text-muted-foreground shrink-0" />
          </button>
        ) : (
          <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        )
      )}
      {value !== undefined && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {children}
    </div>
  );
}
