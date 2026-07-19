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

export const scrollToElement = (id: string) => {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 20; // 20px padding
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }, 100);
};
