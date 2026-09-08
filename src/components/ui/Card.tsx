import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: ReactNode;
  value?: string | number;
  children?: ReactNode;
  className?: string;
  id?: string;
  // Açılır-kapanır kart: collapsible iken başlık tıklanabilir; open=false ise gövde gizlenir.
  // KAPALIYKEN dikkat çekici dolu (primary) bar; AÇIKKEN sade başlık. (Ekleme formları için.)
  collapsible?: boolean;
  open?: boolean;
  onToggleOpen?: () => void;
}

export function Card({ title, value, children, className, id, collapsible, open = true, onToggleOpen }: CardProps) {
  // Kapalı (collapsible + !open): tüm kart, dikkat çekici dolu primary bir bar olur.
  if (collapsible && !open) {
    return (
      <button
        id={id}
        type="button"
        onClick={onToggleOpen}
        aria-expanded={false}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-4 py-3.5 hover:bg-primary/90 active:scale-[0.99] transition-all shadow-sm",
          className
        )}
      >
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Plus size={18} />
        </span>
        <span className="flex-1 text-left font-medium text-[15px]">{title}</span>
        <ChevronDown size={18} className="opacity-80 shrink-0" />
      </button>
    );
  }

  return (
    <div id={id} className={cn("p-4 rounded-xl glass", className)}>
      {title && (
        collapsible ? (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 text-left mb-1"
          >
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <ChevronUp size={18} className="text-muted-foreground shrink-0" />
          </button>
        ) : (
          <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        )
      )}
      {value !== undefined && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {children}
    </div>
  );
}
