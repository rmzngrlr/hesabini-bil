import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useBudget } from './BudgetContext';
import { filterSearchIndex, type SearchRecord } from '../lib/search';
import { cn } from '../lib/utils';

interface SearchContextType {
  openSearch: () => void;
  closeSearch: () => void;
  isOpen: boolean;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function useSearch(): SearchContextType {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}

function formatAmount(rec: SearchRecord): { text: string; positive: boolean } {
  const positive = rec.amount >= 0;
  const sign = positive ? '+' : '−';
  const abs = Math.abs(rec.amount);
  if (rec.amountKind === 'try') {
    return { text: `${sign}${Math.round(abs).toLocaleString('tr-TR')} ₺`, positive };
  }
  // Varlik (doviz/altin): tur adiyla birlikte
  const unit = rec.assetType || '';
  const num = Number.isInteger(abs) ? abs.toLocaleString('tr-TR') : abs.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return { text: `${sign}${num}${unit ? ' ' + unit : ''}`, positive };
}

function monthLabel(month: string): string {
  try {
    return format(new Date(`${month}-01T00:00:00`), 'MMMM yyyy', { locale: tr });
  } catch {
    return month;
  }
}

function shortDate(date: string): string {
  const ymd = String(date ?? '').substring(0, 10);
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return ymd;
  try {
    return format(d, 'd MMM', { locale: tr });
  } catch {
    return ymd;
  }
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { searchIndex, setViewDate } = useBudget();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Acilinca girise odaklan.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Esc ile kapat + arka plani kaydirmayi kilitle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Debounce (250ms).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const results = useMemo(() => filterSearchIndex(searchIndex, debounced), [searchIndex, debounced]);

  // Ay basligiyla grupla (indeks zaten tarih azalan sirali).
  const groups = useMemo(() => {
    const map = new Map<string, SearchRecord[]>();
    for (const r of results) {
      const arr = map.get(r.month);
      if (arr) arr.push(r); else map.set(r.month, [r]);
    }
    return Array.from(map.entries());
  }, [results]);

  const goToRecord = useCallback((rec: SearchRecord) => {
    onClose();
    // 1. Goruntulenen ay (context; navigasyon boyunca kalici).
    setViewDate(rec.month);
    // 2. Islemler varlik sekmesi mount ilk degeri (flash olmasin diye) — ayrica hedef sayfa
    //    location.state'ten de set eder (zaten mount'lu sayfa icin).
    if (rec.route === '/islemler' && rec.assetTab) {
      try { sessionStorage.setItem('daily_draft_tab', JSON.stringify(rec.assetTab)); } catch { /* yoksay */ }
    }
    // 3. Deep-link state ile git; hedef sayfa mount/guncelleme effect'inde tuketip temizler.
    navigate(rec.route, {
      state: {
        deepLink: {
          key: rec.key,
          month: rec.month,
          subTab: rec.subTab ?? null,
          exchangeMode: rec.exchangeMode ?? null,
          assetTab: rec.assetTab ?? null,
        },
      },
    });
  }, [navigate, onClose, setViewDate]);

  const hasQuery = debounced.trim().length >= 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-black/40 backdrop-blur-sm px-4 pt-[12vh] pb-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Arama"
    >
      <div
        className="w-full max-w-lg max-h-full flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Arama cubugu */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Search size={20} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Başlık veya tutar ara…"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground min-w-0"
          />
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="shrink-0 text-xs text-muted-foreground border border-border rounded-md px-2 py-1 hover:bg-secondary transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Sonuclar yalniz yazilinca (>=2 harf) acilir; bos durumda sadece cubuk gorunur. */}
        {hasQuery && (
          <>
          <div className="overflow-y-auto overscroll-contain border-t border-border">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              “{debounced}” için sonuç bulunamadı.
            </p>
          ) : (
            <div className="p-2">
              {groups.map(([month, recs]) => (
                <div key={month} className="mb-1">
                  <p className="text-xs text-muted-foreground px-3 pt-2 pb-1 capitalize">{monthLabel(month)}</p>
                  {recs.map(rec => {
                    const amt = formatAmount(rec);
                    return (
                      <button
                        key={rec.key + rec.date + rec.title}
                        onClick={() => goToRecord(rec)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-secondary transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {rec.title}
                            {rec.installmentInfo && rec.installmentInfo.total > 0 && (
                              <span className="text-xs text-muted-foreground font-normal ml-1">
                                ({rec.installmentInfo.current}/{rec.installmentInfo.total})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground whitespace-nowrap">
                              {rec.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {shortDate(rec.date)}
                            </span>
                          </div>
                        </div>
                        <span className={cn('text-sm font-semibold whitespace-nowrap', amt.positive ? 'text-green-500' : 'text-red-500')}>
                          {amt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          </div>

          {/* Alt bilgi */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
            <CornerDownLeft size={13} />
            <span>Sonuca dokun → ilgili ay, sayfa ve sekmeye götürür</span>
          </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);

  // Masaustu kisayolu: Cmd/Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ openSearch, closeSearch, isOpen }), [openSearch, closeSearch, isOpen]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {isOpen && <SearchOverlay onClose={closeSearch} />}
    </SearchContext.Provider>
  );
}
