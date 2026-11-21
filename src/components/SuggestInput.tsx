import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '../lib/utils';

// Türkçe-duyarlı küçük harf (İ/ı) — filtrelemede doğru eşleşme için.
const trLower = (s: string) => s.toLocaleLowerCase('tr');

interface SuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

/**
 * Açıklama alanı için temalı (dark/light) özel öneri kutusu. Native <datalist> yerine kullanılır:
 * (1) HARF yazılmadan liste açılmaz — yalnız en az 1 karakter yazınca ve eşleşme varsa açılır.
 * (2) Tarayıcı native listesi gibi beyaz değil; tema token'larıyla (bg-popover...) renklenir.
 * Eşleşme: büyük/küçük harf duyarsız alt-dize; tam yazılan değer önerilmez.
 */
export function SuggestInput({ value, onChange, suggestions, placeholder, required, className, id }: SuggestInputProps) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef<number | null>(null);

  const q = value.trim();
  const ql = trLower(q);
  const matches = q.length >= 1
    ? suggestions.filter((s) => { const sl = trLower(s); return sl.includes(ql) && sl !== ql; }).slice(0, 10)
    : [];
  const open = focused && matches.length > 0;

  const choose = (s: string) => {
    onChange(s);
    setHighlight(-1);
    setFocused(false); // seçince kapat (input odakta kalır)
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { if (highlight >= 0 && highlight < matches.length) { e.preventDefault(); choose(matches[highlight]); } }
    else if (e.key === 'Escape') { setFocused(false); setHighlight(-1); }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setHighlight(-1); }}
        onFocus={() => { if (blurTimer.current != null) { clearTimeout(blurTimer.current); blurTimer.current = null; } setFocused(true); }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 120); }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {matches.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // mousedown + preventDefault: input blur'dan ÖNCE seçimi al (liste kapanmadan).
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors text-foreground",
                  i === highlight ? "bg-secondary" : "hover:bg-secondary/70"
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
