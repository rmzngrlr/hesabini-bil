import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, TurkishLira } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Özet', icon: LayoutDashboard },
  { path: '/fixed', label: 'Sabit', icon: Wallet },
  { path: '/daily', label: 'Günlük', icon: TurkishLira },
  { path: '/debt', label: 'Borç', icon: CreditCard },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {children}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-card border-border z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary/80"
                )
              }
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
