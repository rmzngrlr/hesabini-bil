import type { ReactNode } from 'react';
import { usePrivacy } from '../context/PrivacyContext';

// React cocuklarini duz metne cevir (string/number/dizi). JSX elemani / karma
// icerik varsa null doner (o durumda komple maske basilir).
function nodeToText(node: ReactNode): string | null {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    let out = '';
    for (const n of node) {
      const t = nodeToText(n);
      if (t === null) return null;
      out += t;
    }
    return out;
  }
  return null;
}

/**
 * Gizlilik modu acikken YALNIZ SAYILARI maskeler: rakamla baslayan gruplari (or.
 * "1.234,56", "0,76") •••• yapar; para birimi sembolu / birimi (₺, $, Gram, USD,
 * د.إ ...) gorunur kalir. Desen rakamla basladigi icin semboldeki tek nokta/virgul
 * (or. "د.إ") maskelenmez. Kapaliyken cocuklari oldugu gibi gosterir; duz metne
 * cevrilemezse komple ••••. Yalniz gorunum — hicbir hesaplamayi/degeri degistirmez.
 */
export function Secret({ children, className }: { children: ReactNode; className?: string }) {
  const { hidden } = usePrivacy();
  if (!hidden) return <>{children}</>;
  const text = nodeToText(children);
  const masked = text === null ? '••••' : text.replace(/\d[\d.,]*/g, '••••');
  return (
    <span className={className} aria-hidden="true" style={{ userSelect: 'none' }}>{masked}</span>
  );
}
