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
  const { dueBillsCount, dueFixedExpensesCount, autoPaidBillsCount, ccDueNoticeCount } = useBudget();

  // Menu butonlarindaki KIRMIZI uyari rozetleri (senin odemen gereken): yol -> sayi.
  const badgeCounts: Record<string, number> = {
    '/islemler': dueBillsCount,
    '/varliklarim': dueFixedExpensesCount,
  };
  // MAVI bilgi rozetleri (otomatik odendi / ekstre bildirimi): yol -> sayi.
  const infoBadgeCounts: Record<string, number> = {
    '/islemler': autoPaidBillsCount,
    '/borc': ccDueNoticeCount,
  };

  useEffect(() => {
    const currentItem = navItems.find(item => item.path === location.pathname);
    // Bilanço (ana sayfa, '/') icin sekme basligi sade: sadece "Hesabını Bil!".
    // Diger sayfalar: "Hesabını Bil! | <sayfa>".
    if (currentItem && currentItem.path !== '/') {
      document.title = `Hesabını Bil! | ${currentItem.label}`;
    } else {
      document.title = 'Hesabını Bil!';
    }
  }, [location.pathname]);

  // Kok div'de bg-background BILEREK yok: body'deki gradyan zeminin gorunmesi
  // gerekiyor, opak bir arka plan onu tamamen orterdi.
  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden text-foreground w-full max-w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r glass-blur p-6 space-y-8 fixed h-full left-0 top-0 overflow-y-auto">
        <div className="flex items-center gap-3 px-2">
          {/* Favicon'daki (public/icon.svg) marka isareti: dolu rozet gorunumu.
              Renkler bilerek acikca yazildi (bg-primary + text-primary-foreground),
              saydamlik ekine bagli degil; boylece temaya gore tam ters cevrilir:
              acik temada koyu kutu + beyaz TL, koyu temada beyaz kutu + koyu TL. */}
          <div className="p-2 bg-primary rounded-lg">
            <span
              aria-hidden="true"
              className="text-primary-foreground w-6 h-6 flex items-center justify-center text-2xl font-bold leading-none"
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
              {((badgeCounts[path] ?? 0) > 0 || (infoBadgeCounts[path] ?? 0) > 0) && (
                <span className="ml-auto flex items-center gap-1">
                  {(infoBadgeCounts[path] ?? 0) > 0 && (
                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-sky-500 text-white text-xs font-bold">
                      {infoBadgeCounts[path]}
                    </span>
                  )}
                  {(badgeCounts[path] ?? 0) > 0 && (
                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                      {badgeCounts[path]}
                    </span>
                  )}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t glass-blur z-50 safe-area-pb">
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
                  {(badgeCounts[path] ?? 0) > 0 && (
                    <span className="absolute top-1 right-1/2 translate-x-4 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {badgeCounts[path]}
                    </span>
                  )}
                  {(infoBadgeCounts[path] ?? 0) > 0 && (
                    <span className="absolute top-1 right-1/2 -translate-x-6 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-none">
                      {infoBadgeCounts[path]}
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
