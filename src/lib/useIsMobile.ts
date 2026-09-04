import { useEffect, useState } from 'react';

/**
 * Mobil tespiti: dar viewport (<768) VEYA coarse pointer (dokunmatik cihaz).
 * Masaustunde (genis + fine pointer) daima false doner. Cihaz kilidi yalniz
 * mobilde devreye girsin diye kullanilir.
 */
export function computeIsMobile(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    return narrow || coarse;
  } catch {
    return false;
  }
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => computeIsMobile());

  useEffect(() => {
    const update = () => setIsMobile(computeIsMobile());
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia('(max-width: 767px)'); } catch { mq = null; }
    mq?.addEventListener?.('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq?.removeEventListener?.('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isMobile;
}
