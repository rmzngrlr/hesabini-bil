import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Fingerprint, Lock, Delete } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBudget } from '../context/BudgetContext';
import { useIsMobile } from '../lib/useIsMobile';
import { isDeviceLockEnabled, isDeviceLockSupported, verifyDeviceLock, getLastActive, markActive } from '../lib/deviceLock';
import { verifyPinAgainst } from '../lib/pinLock';
import { API_URL } from '../services/api';

/**
 * Uygulama kilidi kapisi. Ayarlar HESAP-BAZLI (BudgetState, tum cihazlarda senkron):
 * paylasilan PIN (lockPin) + cihaz-tipine gore acma/kapama (lockOnMobile/Desktop) +
 * kullanilmazsa kilit gecikmesi (lockRelockMinutes). Parmak izi kaydi cihaz-yereldir
 * (WebAuthn senkronlanamaz). BudgetProvider ICINDE oldugundan hesap ayarlarina erisir
 * (kilitliyken veri bellekte olsa da UI kilit ekraninin arkasindadir). Kilit ekrani
 * uygulamanin kendi temasindadir: PIN tus takimi + (varsa) "Parmak izi ile aç". Her
 * acilis/yenilemede (soguk baslatma) kilitli baslar; grace yalniz ayni oturum ici kisa
 * arka-plan/sekme gecisleri + bosta-acik icindir. "Cikis" ile lockout olmaz.
 */
export function DeviceLockGate({ children }: { children: ReactNode }) {
  const { logout, username } = useAuth();
  const { lockPin, lockOnMobile, lockOnDesktop, lockRelockMinutes, setLockPin } = useBudget();
  const isMobile = useIsMobile();

  const enabledForDevice = isMobile ? lockOnMobile : lockOnDesktop;
  const pinSet = !!lockPin;
  const pinLen = lockPin?.len ?? 0;
  const bioAvailable = isDeviceLockSupported() && isDeviceLockEnabled();
  const lockActive = enabledForDevice && (pinSet || bioAvailable);

  // Her acilis/yenilemede (soguk baslatma) kilitli baslar (kilit bu cihazda aktifse).
  const [unlocked, setUnlocked] = useState<boolean>(() => !lockActive);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const autoBioTriedRef = useRef(false);
  // "PIN'i unuttum": hesap sifresiyle dogrulayip hesaptaki PIN'i sifirla.
  const [showForgot, setShowForgot] = useState(false);
  const [pwd, setPwd] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  const handleForgot = async () => {
    if (forgotBusy || !pwd) return;
    setForgotBusy(true);
    setForgotError(null);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pwd }),
      });
      if (res.ok) {
        setLockPin(null); // hesaptaki PIN'i temizle (senkron) -> yeni PIN Ayarlar'dan
        markActive();
        setUnlocked(true); // sifre dogrulandi -> ac
      } else {
        setForgotError('Hesap şifresi yanlış.');
      }
    } catch {
      setForgotError('Doğrulanamadı. Bağlantınızı kontrol edin.');
    } finally {
      setForgotBusy(false);
    }
  };

  // lockActive kapaninca (kilit kaldirildi / cihaz-tipi kapandi) icerigi ac.
  useEffect(() => {
    if (!lockActive) setUnlocked(true);
  }, [lockActive]);

  // Aktiflik takibi + idle kilit. "Son aktif" GERCEK etkilesimde tazelenir (throttle
  // 5sn). 15sn kontrol: sekme acik+gorunur olsa BILE son etkilesimden bu yana gecen
  // sure gecikmeyi asmissa kilitlenir. Arka plandan donuste de kontrol edilir. Gecikme
  // 0 ('Hemen') iken bosta-acik kilidi yok; yalniz ayrilista/donuste. Gecikme HESAPTAN.
  useEffect(() => {
    if (!lockActive || !unlocked) return;
    markActive();
    const graceMs = () => lockRelockMinutes * 60000;
    const lock = () => { setUnlocked(false); setPin(''); };

    let lastMark = Date.now();
    const onActivity = () => {
      const now = Date.now();
      if (now - lastMark < 5000) return; // throttle
      lastMark = now;
      markActive();
    };
    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    activityEvents.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

    const check = window.setInterval(() => {
      const g = graceMs();
      if (g <= 0 || document.visibilityState !== 'visible') return;
      if (Date.now() - getLastActive() >= g) lock();
    }, 15000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - getLastActive() >= graceMs()) lock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(check);
      activityEvents.forEach(ev => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [lockActive, unlocked, lockRelockMinutes]);

  // PIN uzunlugu tamamlaninca hesaptaki PIN kaydiyla otomatik dogrula.
  useEffect(() => {
    if (!pinSet || pinLen <= 0 || pin.length !== pinLen) return;
    let cancelled = false;
    setVerifying(true);
    setError(null);
    verifyPinAgainst(pin, lockPin).then(ok => {
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
  }, [pin, pinSet, pinLen, lockPin]);

  // Masaustu: fiziksel klavye ile PIN gir (rakam tuslari + Backspace).
  useEffect(() => {
    if (unlocked || !lockActive || !pinSet) return;
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
  }, [unlocked, lockActive, pinSet, verifying, pinLen]);

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
      if (ok) { markActive(); setUnlocked(true); }
      else setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
    } catch {
      setError('Parmak izi doğrulanamadı. Tekrar deneyin.');
    } finally {
      setVerifying(false);
    }
  };

  // PIN YOKSA (yalniz biyometri): dugme beklemeden dogrudan parmak izi istemini ac.
  useEffect(() => {
    if (unlocked) { autoBioTriedRef.current = false; return; }
    if (!lockActive || pinSet || !bioAvailable || autoBioTriedRef.current) return;
    autoBioTriedRef.current = true;
    (async () => {
      try {
        const ok = await verifyDeviceLock();
        if (ok) { markActive(); setUnlocked(true); }
      } catch { /* sessiz: dugme kalir */ }
    })();
  }, [unlocked, lockActive, pinSet, bioAvailable]);

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
          {pinSet ? 'PIN kodunuzu girin.' : 'Devam etmek için cihaz kilidinizle doğrulayın.'}
        </p>
      </div>

      {pinSet && pinLen > 0 && (
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

      {/* PIN'i unuttum -> hesap sifresiyle dogrula ve hesaptaki PIN'i sifirla */}
      {pinSet && !showForgot && (
        <button
          onClick={() => { setShowForgot(true); setForgotError(null); }}
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          PIN'imi unuttum
        </button>
      )}

      {pinSet && showForgot && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleForgot(); }}
          className="flex flex-col items-center gap-3 w-full max-w-[260px]"
        >
          <p className="text-xs text-muted-foreground text-center">
            Hesap şifrenizle doğrulayın; PIN sıfırlanır ve Ayarlar'dan yeniden belirleyebilirsiniz.
          </p>
          <input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setForgotError(null); }}
            placeholder="Hesap şifresi"
            className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground text-center outline-none focus:ring-2 focus:ring-primary/40"
          />
          {forgotError && <p className="text-sm text-red-500 text-center">{forgotError}</p>}
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => { setShowForgot(false); setPwd(''); setForgotError(null); }}
              disabled={forgotBusy}
              className="flex-1 px-4 py-3 rounded-xl bg-secondary text-foreground font-medium disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={forgotBusy || !pwd}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60"
            >
              {forgotBusy ? 'Doğrulanıyor…' : 'Sıfırla'}
            </button>
          </div>
        </form>
      )}

      <button onClick={logout} className="text-sm text-muted-foreground underline underline-offset-2">
        Hesap şifresiyle gir / Çıkış
      </button>
    </div>
  );
}
