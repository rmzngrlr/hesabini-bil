import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: ReactNode;
  value?: string | number;
  children?: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ title, value, children, className, id }: CardProps) {
  return (
    <div id={id} className={cn("p-4 rounded-xl glass", className)}>
      {title && <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>}
      {value !== undefined && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {children}
    </div>
  );
}
