import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Sun, Moon, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { Avatar } from './ui/Avatar';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';

/**
 * Mobil Bilanço sağ üstündeki profil butonu: kullanıcı adı + avatar tek buton.
 * Dokununca sola akordiyon gibi açılıp Tema, Ayarlar, Çıkış çıkar.
 */
export function MobileProfileMenu() {
  const { theme, toggleTheme } = useBudget();
  const { username, logout, avatar } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (username?.trim().charAt(0) || '?').toUpperCase();

  // Disariya dokununca kapat.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const iconBtn = "w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0";

  return (
    <div ref={ref} className="flex items-center bg-secondary rounded-full p-1">
      <div className={cn(
        "flex items-center overflow-hidden transition-all duration-300",
        open ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
      )}>
        <button onClick={toggleTheme} aria-label="Tema" className={cn(iconBtn, "text-muted-foreground hover:text-primary")}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/ayarlar" aria-label="Ayarlar" onClick={() => setOpen(false)} className={cn(iconBtn, "text-muted-foreground hover:text-primary")}>
          <SettingsIcon size={18} />
        </Link>
        <button onClick={logout} aria-label="Çıkış" className={cn(iconBtn, "text-red-500 hover:bg-red-500/10")}>
          <LogOut size={18} />
        </button>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
      </div>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 pl-2 pr-1" aria-label="Profil menüsü">
        <span className="text-sm font-medium whitespace-nowrap">{username || 'Hesabım'}</span>
        <Avatar src={avatar} initial={initial} className="w-8 h-8 text-xs" />
      </button>
    </div>
  );
}
