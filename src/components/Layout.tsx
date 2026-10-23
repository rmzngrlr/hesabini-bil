import type { ReactNode, TouchEvent as ReactTouchEvent } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, ArrowRightLeft, Settings, Sun, Moon, LogOut, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { Avatar } from './ui/Avatar';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';

// Deger gizlemeyi acan pull-up jesti icin esik (px). En altta bu kadar yukari
// cekince (bosluk asilinca) birakinca tetiklenir. Yuksek tutuldu ki kazara
// degil, bilincli/agresif cekiste tetiklensin.
const PULL_THRESHOLD = 130;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  // Rota degisince ana kaydirma kutusunu en uste al (onceki sayfanin scroll
  // konumunda acilmasin). useLayoutEffect: boyamadan once -> titremesiz.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [location.pathname]);
  // Not: --app-vh olcumu App seviyesine (useViewportHeightVar) tasindi -> global.

  const { dueBillsCount, dueFixedExpensesCount, autoPaidBillsCount, ccDueNoticeCount, pendingIncomingGoldCount, theme, toggleTheme } = useBudget();
  const { username, logout, avatar } = useAuth();

  // Deger gizleme (mobil): en altta parmagi yukari agresif cekince (pull-up)
  // ac/kapa. Ust pull-to-refresh'in alt karsiligi. Cekildikce yukselen ipucu
  // gosterilir; esik asilip birakilinca tetiklenir (kazara olmasin diye).
  const { hidden: valuesHidden, toggle: togglePrivacy } = usePrivacy();
  const [pullUp, setPullUp] = useState(0);
  const pullAnchorY = useRef<number | null>(null);

  const onScrollTouchStart = () => { pullAnchorY.current = null; };
  const onScrollTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    // Jest yalniz Bilanço (/) sayfasinda; gizleme/gosterme yine tum sayfalari etkiler (global).
    if (location.pathname !== '/') return;
    const el = scrollRef.current;
    if (!el || e.touches.length !== 1) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 1;
    const y = e.touches[0].clientY;
    if (!atBottom) {
      pullAnchorY.current = null;
      if (pullUp !== 0) setPullUp(0);
      return;
    }
    if (pullAnchorY.current === null) pullAnchorY.current = y;
    const dy = pullAnchorY.current - y; // yukari cekis pozitif
    setPullUp(dy > 0 ? Math.min(dy, PULL_THRESHOLD * 1.6) : 0);
  };
  const onScrollTouchEnd = () => {
    if (pullUp >= PULL_THRESHOLD) {
      togglePrivacy();
      try { if (typeof navigator.vibrate === 'function') navigator.vibrate(15); } catch { /* yoksay */ }
    }
    pullAnchorY.current = null;
    setPullUp(0);
  };

  // Masaustu menu daraltma durumu (localStorage'da hatirlanir).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem('sidebar_collapsed', String(next)); } catch { /* yoksay */ }
    return next;
  });

  const initial = (username?.trim().charAt(0) || '?').toUpperCase();

  // Menu butonlarindaki KIRMIZI uyari rozetleri (senin odemen gereken): yol -> sayi.
  const badgeCounts: Record<string, number> = {
    '/': pendingIncomingGoldCount,
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
    <div className="flex app-height overflow-hidden text-foreground w-full max-w-full">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r glass-blur fixed h-full left-0 top-0 z-40 transition-[width] duration-300",
        collapsed ? "w-20" : "w-64"
      )}>
        {/* Logo — Bilanco'ya (/) gider; zaten Bilanco'daysa en uste kaydirir. */}
        <Link
          to="/"
          onClick={() => scrollRef.current?.scrollTo(0, 0)}
          aria-label="Bilanço'ya git"
          className={cn("flex items-center h-16 shrink-0 transition-opacity hover:opacity-80", collapsed ? "justify-center" : "gap-3 px-6")}
        >
          {/* Favicon'daki (public/icon.svg) marka isareti: dolu rozet. Renkler bilerek
              acikca yazildi; temaya gore tam ters: acik temada koyu kutu + beyaz TL,
              koyu temada beyaz kutu + koyu TL. */}
          <div className="p-2 bg-primary rounded-lg shrink-0">
            <span aria-hidden="true" className="text-primary-foreground w-6 h-6 flex items-center justify-center text-2xl font-bold leading-none">₺</span>
          </div>
          {!collapsed && <span className="text-xl font-bold tracking-tight whitespace-nowrap">Hesabını Bil!</span>}
        </Link>

        {/* Nav */}
        <nav className={cn("flex-1 space-y-2 py-2", collapsed ? "px-3" : "px-4 overflow-y-auto")}>
          {currentNavItems.map(({ path, label, icon: Icon }) => {
            const red = badgeCounts[path] ?? 0;
            const info = infoBadgeCounts[path] ?? 0;
            return (
              <NavLink
                key={path}
                to={path}
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center rounded-xl transition-all font-medium relative",
                    collapsed ? "justify-center h-11" : "gap-3 px-4 py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50">
                    {label}
                  </span>
                )}
                {collapsed
                  ? (red > 0 || info > 0) && (
                      <span className="absolute top-1.5 right-1.5 flex gap-0.5">
                        {red > 0 && <span className="w-2 h-2 rounded-full bg-red-500" />}
                        {info > 0 && <span className="w-2 h-2 rounded-full bg-sky-500" />}
                      </span>
                    )
                  : (red > 0 || info > 0) && (
                      <span className="ml-auto flex items-center gap-1">
                        {info > 0 && (
                          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-sky-500 text-white text-xs font-bold">
                            {info}
                          </span>
                        )}
                        {red > 0 && (
                          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                            {red}
                          </span>
                        )}
                      </span>
                    )}
              </NavLink>
            );
          })}
        </nav>

        {/* Profil bolumu */}
        <div className={cn("shrink-0 pb-4", collapsed ? "px-3" : "px-4")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Avatar src={avatar} initial={initial} title={username || undefined} className="w-9 h-9 text-sm" />
              <Link to="/ayarlar" title="Ayarlar" className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <Settings size={20} />
              </Link>
              <button onClick={toggleTheme} title="Tema" className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={logout} title="Çıkış" className="w-10 h-10 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-1.5 flex items-center gap-1.5">
              <Avatar src={avatar} initial={initial} className="w-9 h-9 text-sm" />
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{username || 'Hesabım'}</span>
              <Link to="/ayarlar" title="Ayarlar" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0">
                <Settings size={17} />
              </Link>
              <button onClick={toggleTheme} title="Tema" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0">
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button onClick={logout} title="Çıkış" className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 border border-red-500/40 hover:bg-red-500/10 transition-colors shrink-0">
                <LogOut size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar ac/kapa dugmesi: sag sinir cizgisinde, TL logosu hizasinda */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Menüyü aç' : 'Menüyü daralt'}
        className={cn(
          "hidden md:flex fixed top-[22px] z-50 w-5 h-5 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-[left] duration-300",
          collapsed ? "left-[70px]" : "left-[246px]"
        )}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        onTouchStart={onScrollTouchStart}
        onTouchMove={onScrollTouchMove}
        onTouchEnd={onScrollTouchEnd}
        className={cn(
        // Alt nav h-16 (64px) kadar bosluk + main'in 16px alt padding'i -> ~16px
        // rahat bosluk. Onceki pb-20 (80px) + sayfa/main cift padding (32px)
        // gereksiz fazlaydi (~48px). Sayfa kok p-4'leri kaldirildi (tekil main).
        "flex-1 flex flex-col h-full overflow-y-auto pb-16 md:pb-0 transition-all duration-300 min-w-0",
        collapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <main className="flex-1 p-4 w-full mx-auto md:p-8 md:max-w-[1450px] min-w-0">
          {children}
        </main>
      </div>

      {/* Deger gizleme pull-up ipucu (mobil): en altta yukari cekince gorunur,
          esik asilinca "Bırak" der; birakinca ac/kapa olur. */}
      {pullUp > 0 && location.pathname === '/' && (
        <div
          className="md:hidden fixed left-0 right-0 z-40 flex justify-center pointer-events-none"
          style={{ bottom: '4.5rem', opacity: Math.min(pullUp / PULL_THRESHOLD, 1) }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full glass-blur border border-border text-sm font-medium text-foreground shadow-lg"
            style={{ transform: `translateY(${Math.max(0, 16 - pullUp / 5)}px)` }}
          >
            {valuesHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>
              {pullUp >= PULL_THRESHOLD
                ? (valuesHidden ? 'Bırak: göster' : 'Bırak: gizle')
                : (valuesHidden ? 'Değerleri göster' : 'Değerleri gizle')}
            </span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t glass-blur nav-opaque z-50 safe-area-pb">
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
