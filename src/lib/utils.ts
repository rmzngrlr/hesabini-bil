import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Yerel saate göre YYYY-MM-DD döndürür.
 * DİKKAT: new Date().toISOString() UTC verir; Türkiye (UTC+3) gibi pozitif
 * offsetlerde gece 00:00-03:00 arasında bir ÖNCEKİ günü döndürür. Takvim günü
 * ile çalışan her yerde bu helper kullanılmalıdır.
 */
export function getTodayStr(): string {
  return toLocalDateStr(new Date());
}

/** Verilen Date nesnesini yerel saate göre YYYY-MM-DD'ye çevirir. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Verilen Date nesnesini (varsayılan: şimdi) yerel saate göre YYYY-MM'e çevirir. */
export function toLocalMonthStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Bir kredi kartı borcu "bekleyen" mi? (günü henüz gelmemiş)
 * Yalnızca içinde bulunulan ayda ve tarihi bugünden SONRA olan kalemler bekler.
 * Geçmiş/gelecek ay görünümlerinde ve tarihsiz kalemlerde bekleme uygulanmaz.
 * Toplam hesabı ve liste görünümü AYNI bu fonksiyonu kullanır (tek kaynak).
 */
export function isDebtPending(
  date: string | undefined,
  isCurrentMonth: boolean,
  todayStr: string
): boolean {
  return isCurrentMonth && !!date && date > todayStr;
}

/**
 * Bir kredi kartı harcamasının hangi ekstreye (YYYY-MM) düştüğünü döndürür.
 * cutoff = hesap kesim günü. Gün <= cutoff ise o ay; gün > cutoff ise SONRAKİ ay
 * (Aralık'ta yıl döner). cutoff yoksa (null/undefined/0) takvim ayı = mevcut davranış.
 * dateStr yoksa undefined döner (çağıran, viewDate gibi bir varsayılana düşer).
 */
export function statementMonth(
  dateStr: string | undefined,
  cutoff: number | null | undefined
): string | undefined {
  if (!dateStr) return undefined;
  const ymd = String(dateStr).substring(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd.substring(0, 7) || undefined;
  if (!cutoff || d <= cutoff) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/**
 * Türkçe "ayın X'X" ekini üretir: sayının okunuşundaki son ünlüye (ve ünlüyle bitmesine)
 * göre iyelik eki. Ör. 30 -> "30'u" (otuz), 26 -> "26'sı" (altı), 2 -> "2'si" (iki),
 * 3 -> "3'ü" (üç), 20 -> "20'si" (yirmi), 1 -> "1'i". d: 1-31.
 */
export function ayinGunu(d: number): string {
  const units = d % 10;
  const key = units === 0 ? d : units; // 10/20/30 -> onlar sözcüğü; değilse birler
  const ekler: Record<number, string> = {
    1: "'i", 2: "'si", 3: "'ü", 4: "'ü", 5: "'i", 6: "'sı", 7: "'si", 8: "'i", 9: "'u",
    10: "'u", 20: "'si", 30: "'u",
  };
  return `${d}${ekler[key] ?? "'i"}`;
}

export const scrollToElement = (id: string) => {
  // DIKKAT: window.scrollTo KULLANMA. Uygulamanin gercek kaydirma kabi pencere degil,
  // Layout'taki ic 'overflow-y-auto' div'idir (kok 'overflow-hidden'). scrollIntoView en
  // yakin kaydirilabilir atayi otomatik bulup onu kaydirir -> her kapta calisir.
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
};

/**
 * Global arama deep-link'i: data-search-key eslesen satiri bulup ana kaydirma kutusu
 * icinde ortalar ve kisa bir vurgu (ring flash) uygular.
 *
 * DIKKAT: Cagiran taraf bunu useLayoutEffect'te DEGIL, useEffect icinde cagirmalidir;
 * boylece Layout'un pathname-scroll-reset useLayoutEffect'inden SONRA calisir ve kazanir.
 * Ay/sekme degisimiyle liste henuz render olmamis olabilir; rAF ile birkac kare denenir.
 */
export const scrollToSearchKey = (key: string, maxFrames = 30) => {
  const safe = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const selector = `[data-search-key="${safe}"]`;
  let frames = 0;
  const attempt = () => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try {
        el.animate(
          [
            { boxShadow: '0 0 0 2px rgba(59,130,246,0.65)' },
            { boxShadow: '0 0 0 2px rgba(59,130,246,0)' },
          ],
          { duration: 1600, easing: 'ease-out' }
        );
      } catch { /* animate desteklenmiyorsa yoksay */ }
      return;
    }
    if (frames++ < maxFrames) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
};
