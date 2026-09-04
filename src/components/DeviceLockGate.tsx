import { useEffect, useState, type ReactNode } from 'react';
import { Fingerprint, Lock, Delete } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../lib/useIsMobile';
import { isDeviceLockEnabled, isDeviceLockSupported, verifyDeviceLock, getRelockMinutes } from '../lib/deviceLock';
import { isPinEnabled, getPinLength, verifyPin } from '../lib/pinLock';

/**
 * Mobilde, PIN veya biyometrik kilit kuruluysa uygulama icerigini kilit ekraninin
 * arkasina alir. Kilit ekrani UYGULAMANIN kendi temasindadir: PIN tus takimi +
 * (kuruluysa) "Parmak izi ile aç" dugmesi. Masaustunde veya hic kilit yoksa
 * cocuklari aynen render eder. Kilitliyken BudgetProvider mount edilmez (bu bilesen
 * onu sarar) -> veri cekilmez. Acilista (soguk baslatma) ve arka plan suresi
 * dolunca kilitlenir. "Hesap sifresiyle gir / Cikis" ile lockout olmaz.
 */
export function DeviceLockGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  const pinEnabled = isPinEnabled();
  const bioAvailable = isDeviceLockSupported() && isDeviceLockEnabled();
  const lockActive = isMobile && (pinEnabled || bioAvailable);
  const pinLen = getPinLength();

  const [unlocked, setUnlocked] = useState<boolean>(!lockActive);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  // lockActive kapaninca (or. viewport genisledi / kilit kaldirildi) icerigi ac.
  useEffect(() => {
    if (!lockActive) setUnlocked(true);
  }, [lockActive]);

  // Arka planda X dakika kaldiktan sonra yeniden kilitle. Sekme gizlenince zaman
  // damgasi alinir; geri gelince gecen sure >= ayarli dakika ise kilitlenir.
  useEffect(() => {
    if (!lockActive) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const relockMin = getRelockMinutes();
      if (relockMin >= 0 && hiddenAt > 0 && Date.now() - hiddenAt >= relockMin * 60000) {
        setUnlocked(false);
        setPin('');
      }
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lockActive]);

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
        setUnlocked(true);
      } else {
        setError('Yanlış PIN. Tekrar deneyin.');
        setPin('');
      }
    });
    return () => { cancelled = true; };
  }, [pin, pinEnabled, pinLen]);

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
      if (ok) setUnlocked(true);
      else setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
    } catch {
      setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
    } finally {
      setVerifying(false);
    }
  };

  if (unlocked) return <>{children}</>;

  const digitKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
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
