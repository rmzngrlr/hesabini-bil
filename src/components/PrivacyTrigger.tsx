import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';
import { cn } from '../lib/utils';

/**
 * Deger gizleme tetikleyici (masaustu) — arama butonunun yaninda.
 * Gizliyken EyeOff, gorunurken Eye ikonu.
 */
export function PrivacyTrigger({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy();
  return (
    <button
      onClick={toggle}
      aria-label={hidden ? 'Değerleri göster' : 'Değerleri gizle'}
      title={hidden ? 'Değerleri göster' : 'Değerleri gizle'}
      className={cn(
        'items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
        className
      )}
    >
      {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
}
