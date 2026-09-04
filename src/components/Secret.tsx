import type { ReactNode } from 'react';
import { usePrivacy } from '../context/PrivacyContext';

/**
 * Gizlilik modu acikken cocuklarinin yerine sabit bir maske (••••) basar,
 * kapaliyken cocuklari oldugu gibi gosterir. Cevreleyen elemanin stili (font,
 * renk, boyut) korunur; maske o stili miras alir. Yalniz gorunum — hicbir
 * hesaplamayi/degeri degistirmez.
 */
export function Secret({ children, className }: { children: ReactNode; className?: string }) {
  const { hidden } = usePrivacy();
  if (hidden) {
    return (
      <span className={className} aria-hidden="true" style={{ userSelect: 'none' }}>••••</span>
    );
  }
  return <>{children}</>;
}
