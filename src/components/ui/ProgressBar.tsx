import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
  color?: string;
}

export function ProgressBar({ value, max, label, className, color = 'bg-primary' }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className={cn("w-full space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <span>%{percentage.toFixed(0)}</span>
        </div>
      )}
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
