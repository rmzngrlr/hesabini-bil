import { useEffect, useState, type ReactNode } from 'react';
import { Fingerprint, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../lib/useIsMobile';
import { isDeviceLockEnabled, isDeviceLockSupported, verifyDeviceLock } from '../lib/deviceLock';

/**
 * Mobilde, cihaz kilidi kuruluysa uygulama icerigini biyometri kapisinin arkasina
 * alir. Masaustunde veya kilit kurulu degilse cocuklari aynen render eder (kilit yok).
 * Kilitliyken BudgetProvider bile mount edilmez (bu bilesen onu sarar) -> veri
 * cekilmez. Oturum acilisinda (soguk baslatma) bir kez kilitlenir; "Kilidi Aç"
 * kullanici jesti biyometriyi tetikler.
 */
export function DeviceLockGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  const lockActive = isMobile && isDeviceLockSupported() && isDeviceLockEnabled();

  const [unlocked, setUnlocked] = useState<boolean>(!lockActive);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lockActive kapaninca (or. viewport genisledi / kilit kaldirildi) icerigi ac.
  useEffect(() => {
    if (!lockActive) setUnlocked(true);
  }, [lockActive]);

  const attemptUnlock = async () => {
    setVerifying(true);
    setError(null);
    try {
      const ok = await verifyDeviceLock();
      if (ok) setUnlocked(true);
      else setError('Kilit açılamadı. Lütfen tekrar deneyin.');
    } catch {
      setError('Kilit açılamadı. Lütfen tekrar deneyin.');
    } finally {
      setVerifying(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Lock className="text-primary" size={32} />
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Uygulama kilitli</h1>
        <p className="text-sm text-muted-foreground">Devam etmek için cihaz kilidinizle doğrulayın.</p>
      </div>
      <button
        onClick={attemptUnlock}
        disabled={verifying}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60 transition-opacity"
      >
        <Fingerprint size={20} /> {verifying ? 'Doğrulanıyor…' : 'Kilidi Aç'}
      </button>
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      <button onClick={logout} className="text-sm text-muted-foreground underline underline-offset-2">
        Hesap şifresiyle gir / Çıkış
      </button>
    </div>
  );
}
