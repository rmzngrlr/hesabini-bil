import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
