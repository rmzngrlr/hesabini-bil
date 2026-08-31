import { Search } from 'lucide-react';
import { useSearch } from '../context/SearchContext';
import { cn } from '../lib/utils';

/**
 * Sayfa basliginin sag ustune konan arama tetikleyici (masaustu).
 * Mobilde arama, Bilanco'daki profil menusunde (Ayarlar'in yaninda) yer alir.
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { openSearch } = useSearch();
  return (
    <button
      onClick={openSearch}
      aria-label="Ara"
      title="Ara (⌘K)"
      className={cn(
        'items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
        className
      )}
    >
      <Search size={20} />
    </button>
  );
}
