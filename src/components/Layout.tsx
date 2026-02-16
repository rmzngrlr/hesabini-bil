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
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-6 space-y-8 fixed h-full left-0 top-0 overflow-y-auto">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <LayoutDashboard className="text-primary w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Hesabını Bil!</span>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="text-xs text-muted-foreground px-4">
          v1.2.0 • Masaüstü Modu
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen pb-20 md:pb-0 md:pl-64 transition-all duration-300">
        <main className="flex-1 p-4 w-full mx-auto md:p-8 md:max-w-7xl">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-lg border-border z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary/80"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "absolute top-0 w-8 h-1 rounded-b-full transition-all duration-300",
                    isActive ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-transparent"
                  )} />
                  <Icon size={20} className={cn("transition-transform duration-300", isActive && "-translate-y-0.5")} />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
