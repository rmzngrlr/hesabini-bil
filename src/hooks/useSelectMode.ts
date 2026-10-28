import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as RPE, MouseEvent as RME } from 'react';

const LONG_PRESS_MS = 450; // basili tutma esigi
const MOVE_SLOP = 10;      // bu kadar kayinca (scroll niyeti) iptal

/**
 * Listelerde "basili tutarak coklu secim" modu.
 *
 * Bir kalemin ikonuna (ya da satir govdesine) basili tutunca mod acilir ve o
 * kalem secilir; moddayken kaleme dokunmak secimi ac/kapa yapar. Secim
 * kalmayinca, ustten ✕ ile, cihazin geri tusuyla ya da (cagiran sayfanin
 * exit()'i tetikledigi) sekme/sayfa degisiminde mod kapanir.
 *
 * Hook YALNIZ secim DURUMUNU yonetir; net toplami ve birimi cagiran sayfa
 * hesaplar (birim ve isaret listeye gore degisir).
 */
export function useSelectMode() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const pushedRef = useRef(false);

  // Basili-tutma gecici durumu (tek dokunus oldugundan tek takim ref yeterli).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFiredRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setSelected(prev => (prev.size ? new Set() : prev));
  }, []);

  const enter = useCallback((id: string) => {
    try { navigator.vibrate?.(12); } catch { /* yok say */ }
    setActive(true);
    setSelected(new Set([id]));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) setActive(false); // secim kalmadi -> moddan cik
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  // Geri tusu ile cikis: mod acilinca ayni URL'ye sahte bir history girisi
  // ekle; geri tusuna basilinca popstate ile moddan cikariz (URL degismez).
  useEffect(() => {
    if (active && !pushedRef.current) {
      pushedRef.current = true;
      try { window.history.pushState({ hbSelect: true }, ''); } catch { /* yok say */ }
    } else if (!active && pushedRef.current) {
      // ✕ / secimsiz kalinca: ekledigimiz girisi geri alip temizle.
      pushedRef.current = false;
      try {
        if (window.history.state && window.history.state.hbSelect) window.history.back();
      } catch { /* yok say */ }
    }
  }, [active]);

  useEffect(() => {
    const onPop = () => {
      if (!pushedRef.current) return; // bizim girisimiz degilse karisma
      pushedRef.current = false;
      setActive(false);
      setSelected(new Set());
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Basili tutma + dokunma baglayicisi. Satirin ikon kabina (ya da fatura
   * satirinda sol butona) yayilir.
   * @param id    kalem kimligi
   * @param onTap mod KAPALIYKEN normal dokunusta calisacak varsa (or. fatura
   *              odendi ac/kapa). Verilmezse kapali modda dokunus bir sey yapmaz.
   */
  const pressProps = useCallback((id: string, onTap?: () => void) => ({
    style: { touchAction: 'pan-y' as const, WebkitUserSelect: 'none' as const, userSelect: 'none' as const },
    onContextMenu: (e: RME) => { e.preventDefault(); },
    onPointerDown: (e: RPE) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      longFiredRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      if (!active) {
        clearTimer();
        timerRef.current = setTimeout(() => { longFiredRef.current = true; enter(id); }, LONG_PRESS_MS);
      }
    },
    onPointerMove: (e: RPE) => {
      const s = startRef.current;
      if (!s) return;
      if (Math.abs(e.clientX - s.x) > MOVE_SLOP || Math.abs(e.clientY - s.y) > MOVE_SLOP) clearTimer();
    },
    onPointerUp: () => { clearTimer(); startRef.current = null; },
    onPointerCancel: () => { clearTimer(); startRef.current = null; },
    onClick: (e: RME) => {
      if (longFiredRef.current) { e.preventDefault(); e.stopPropagation(); longFiredRef.current = false; return; }
      if (active) { e.preventDefault(); e.stopPropagation(); toggle(id); return; }
      if (onTap) onTap();
    },
  }), [active, enter, toggle, clearTimer]);

  return { active, count: selected.size, isSelected, enter, toggle, exit, pressProps };
}
