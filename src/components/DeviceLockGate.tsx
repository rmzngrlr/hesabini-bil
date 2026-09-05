import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint, Lock, Delete } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isDeviceLockEnabled, isDeviceLockSupported, verifyDeviceLock, getRelockMinutes, getLastActive, markActive } from '../lib/deviceLock';
import { isPinEnabled, getPinLength, verifyPin } from '../lib/pinLock';

/**
 * PIN veya biyometrik kilit kuruluysa (cihaz-bazli; mobil ya da masaustu) uygulama
 * icerigini kilit ekraninin arkasina alir. Kilit ekrani UYGULAMANIN kendi
 * temasindadir: PIN tus takimi + (kuruluysa) "Parmak izi ile aç" dugmesi. Hic
 * kilit yoksa cocuklari aynen render eder. Kilitliyken BudgetProvider mount edilmez (bu bilesen
 * onu sarar) -> veri cekilmez. Acilista (soguk baslatma) ve arka plan suresi
 * dolunca kilitlenir. "Hesap sifresiyle gir / Cikis" ile lockout olmaz.
 */
export function DeviceLockGate({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  // Kilit cihaz-bazli: PIN veya biyometri kuruluysa (mobil/masaustu fark etmez).
  const pinEnabled = isPinEnabled();
  const bioAvailable = isDeviceLockSupported() && isDeviceLockEnabled();
  const lockActive = pinEnabled || bioAvailable;
  const pinLen = getPinLength();

  // Baslangic: kilit yoksa acik. Kilit varsa, son kullanimdan bu yana gecen sure
  // kilit gecikmesinden AZ ise (or. kapatip 5 dk icinde geri actiysa) yine acik
  // baslat -> her acilista sifirdan sifreye sormaz.
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (!lockActive) return true;
    const graceMs = getRelockMinutes() * 60000;
    return Date.now() - getLastActive() < graceMs;
  });
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const autoBioTriedRef = useRef(false);

  // lockActive kapaninca (or. viewport genisledi / kilit kaldirildi) icerigi ac.
  useEffect(() => {
    if (!lockActive) setUnlocked(true);
  }, [lockActive]);

  // Aktiflik takibi + idle kilit. Uygulama ON PLANDA + acikken "son aktif" zamani
  // taze tutulur (30sn interval + gizlenince + sayfa kapanirken). Geri gelindiginde
  // gecen sure kilit gecikmesini asmissa kilitlenir. Ayni "son aktif" degeri
  // kapat-ac (soguk baslatma) icin de kullanilir (bkz. baslangic unlocked state).
  useEffect(() => {
    if (!lockActive || !unlocked) return;
    markActive();
    const graceMs = () => getRelockMinutes() * 60000;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markActive();
      } else if (Date.now() - getLastActive() >= graceMs()) {
        setUnlocked(false);
        setPin('');
      } else {
        markActive();
      }
    };
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'visible') markActive();
    }, 30000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', markActive);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', markActive);
    };
  }, [lockActive, unlocked]);

  // PIN uzunlugu tamamlaninca otomatik dogrula.
  useEffect(() => {
    if (!pinEnabled || pinLen <= 0 || pin.length !== pinLen) return;
    let cancelled = false;
    setVerifying(true);
    setError(null);
    verifyPin(pin).then(ok => {
      if (cancelled) return;
      setVerifying(false);
      if (ok) {
        markActive();
        setUnlocked(true);
      } else {
        setError('Yanlış PIN. Tekrar deneyin.');
        setPin('');
      }
    });
    return () => { cancelled = true; };
  }, [pin, pinEnabled, pinLen]);

  // Masaustu: fiziksel klavye ile PIN gir (rakam tuslari + Backspace). Yalniz
  // kilit ekrani gorunurken aktif; acilinca dinleyici kalkar.
  useEffect(() => {
    if (unlocked || !lockActive || !pinEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (verifying) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setError(null);
        setPin(prev => (prev.length >= pinLen ? prev : prev + e.key));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setError(null);
        setPin(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlocked, lockActive, pinEnabled, verifying, pinLen]);

  const pressDigit = (d: string) => {
    if (verifying) return;
    setError(null);
    setPin(prev => (prev.length >= pinLen ? prev : prev + d));
  };
  const pressBack = () => {
    if (verifying) return;
    setError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const attemptBiometric = async () => {
    setVerifying(true);
    setError(null);
    try {
      const ok = await verifyDeviceLock();
      if (ok) {
        markActive();
        setUnlocked(true);
      } else {
        setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
      }
    } catch {
      setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
    } finally {
      setVerifying(false);
    }
  };

  // PIN YOKSA (yalniz biyometri): kilit ekraninda dugme beklemeden dogrudan
  // parmak izi istemini ac. Tarayici kullanici jesti istiyorsa sessizce basarisiz
  // olur; "Parmak izi ile aç" dugmesi yedek olarak kalir.
  useEffect(() => {
    if (unlocked) { autoBioTriedRef.current = false; return; }
    if (!lockActive || pinEnabled || !bioAvailable || autoBioTriedRef.current) return;
    autoBioTriedRef.current = true;
    (async () => {
      try {
        const ok = await verifyDeviceLock();
        if (ok) { markActive(); setUnlocked(true); }
      } catch { /* sessiz: dugme kalir */ }
    })();
  }, [unlocked, lockActive, pinEnabled, bioAvailable]);

  if (unlocked) return <>{children}</>;

  const digitKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="app-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Lock className="text-primary" size={32} />
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Uygulama kilitli</h1>
        <p className="text-sm text-muted-foreground">
          {pinEnabled ? 'PIN kodunuzu girin.' : 'Devam etmek için cihaz kilidinizle doğrulayın.'}
        </p>
      </div>

      {pinEnabled && pinLen > 0 && (
        <div className="flex flex-col items-center gap-5 w-full max-w-[260px]">
          <div className="flex items-center gap-3 h-4">
            {Array.from({ length: pinLen }).map((_, i) => (
              <span
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  i < pin.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full">
            {digitKeys.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => pressDigit(k)}
                disabled={verifying}
                className="aspect-square rounded-full bg-secondary text-foreground text-xl font-semibold hover:bg-secondary/70 active:scale-95 transition disabled:opacity-50"
              >
                {k}
              </button>
            ))}
            <span />
            <button
              type="button"
              onClick={() => pressDigit('0')}
              disabled={verifying}
              className="aspect-square rounded-full bg-secondary text-foreground text-xl font-semibold hover:bg-secondary/70 active:scale-95 transition disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={pressBack}
              disabled={verifying}
              aria-label="Sil"
              className="aspect-square rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/70 active:scale-95 transition disabled:opacity-50"
            >
              <Delete size={22} />
            </button>
          </div>
        </div>
      )}

      {bioAvailable && (
        <button
          onClick={attemptBiometric}
          disabled={verifying}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60 transition-opacity"
        >
          <Fingerprint size={20} /> {verifying ? 'Doğrulanıyor…' : 'Parmak izi ile aç'}
        </button>
      )}

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <button onClick={logout} className="text-sm text-muted-foreground underline underline-offset-2">
        Hesap şifresiyle gir / Çıkış
      </button>
    </div>
  );
}
