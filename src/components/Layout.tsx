import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, ArrowRightLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useBudget } from '../context/BudgetContext';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Bilanço', icon: LayoutDashboard },
  { path: '/varliklarim', label: 'Varlıklarım', icon: Wallet },
  { path: '/islemler', label: 'İşlemler', icon: ArrowRightLeft },
  { path: '/borc', label: 'Borç', icon: CreditCard },
];

export function Layout({ children }: LayoutProps) {
  const currentNavItems = navItems;
  const location = useLocation();
  const { dueBillsCount } = useBudget();

  useEffect(() => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    if (currentItem) {
      document.title = `${currentItem.label} | Hesabını Bil!`;
    } else {
      document.title = 'Hesabını Bil!';
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-background text-foreground w-full max-w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-6 space-y-8 fixed h-full left-0 top-0 overflow-y-auto">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            {/* Favicon'daki (public/icon.svg) marka isareti.
                text-primary sayesinde acik/koyu temaya gore rengi degisir. */}
            <span
              aria-hidden="true"
              className="text-primary w-6 h-6 flex items-center justify-center text-2xl font-bold leading-none"
            >
              ₺
            </span>
          </div>
          <span className="text-xl font-bold tracking-tight">Hesabını Bil!</span>
        </div>

        <nav className="flex-1 space-y-2">
          {currentNavItems.map(({ path, label, icon: Icon }) => (
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
              {path === '/islemler' && dueBillsCount > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {dueBillsCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="text-xs text-center text-muted-foreground px-4">
          © 2026 Hesabını Bil - <span className="whitespace-nowrap">Geliştiren: rgmedya</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto pb-20 md:pb-0 md:pl-64 transition-all duration-300 min-w-0">
        <main className="flex-1 p-4 w-full mx-auto md:p-8 md:max-w-[1450px] min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-lg border-border z-50 safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          {currentNavItems.map(({ path, label, icon: Icon }) => (
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
                  {path === '/islemler' && dueBillsCount > 0 && (
                    <span className="absolute top-1 right-1/2 translate-x-4 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {dueBillsCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
