import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: ReactNode;
  value?: string | number;
  children?: ReactNode;
  className?: string;
  id?: string;
  // Açılır-kapanır kart: collapsible iken başlık tıklanabilir (chevron); open=false ise gövde gizlenir.
  collapsible?: boolean;
  open?: boolean;
  onToggleOpen?: () => void;
}

export function Card({ title, value, children, className, id, collapsible, open = true, onToggleOpen }: CardProps) {
  const showBody = !collapsible || open;
  return (
    <div id={id} className={cn("p-4 rounded-xl glass", className)}>
      {title && (
        collapsible ? (
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <h3 className={cn("text-sm font-medium text-muted-foreground", showBody && "mb-1")}>{title}</h3>
            <ChevronDown size={18} className={cn("text-muted-foreground transition-transform shrink-0", open ? "" : "-rotate-90")} />
          </button>
        ) : (
          <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        )
      )}
      {showBody && value !== undefined && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {showBody && children}
    </div>
  );
}
