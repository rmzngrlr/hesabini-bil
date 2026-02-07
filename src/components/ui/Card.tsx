import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  title: string;
  value?: string | number;
  children?: ReactNode;
  className?: string;
}

export function Card({ title, value, children, className }: CardProps) {
  return (
    <div className={cn("p-4 rounded-xl bg-card border border-border shadow-sm", className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      {value !== undefined && <div className="text-2xl font-bold text-foreground">{value}</div>}
      {children}
    </div>
  );
}
