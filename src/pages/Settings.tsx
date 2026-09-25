import { useEffect, useRef, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth, getAuthToken } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { AvatarCropModal } from '../components/AvatarCropModal';
import { Download, Upload, CreditCard, KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Camera, Trash2, Fingerprint, Lock } from 'lucide-react';
import { exportToExcel, importFromExcel } from '../services/excelService';
import { API_URL } from '../services/api';
import { cn, ayinGunu } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { isDeviceLockEnabled, isDeviceLockSupported, isPlatformAuthenticatorAvailable, registerDeviceLock, disableDeviceLock } from '../lib/deviceLock';
import { computePinRecord } from '../lib/pinLock';

export default function Settings() {
  const { state, loadState, showMealCard, toggleShowMealCard, showVault, toggleShowVault, askConfirmation, askInfo,
    creditCards, addCreditCard, updateCreditCard, deleteCreditCard, isCardInUse,
    lockPin, setLockPin, lockOnMobile, setLockOnMobile, lockOnDesktop, setLockOnDesktop, lockRelockMinutes, setLockRelockMinutes } = useBudget();

  // --- Kredi Kartlarim yonetimi (coklu kart). Bilanço tek toplam; her kart ayri ekstre/kesim. ---
  const CARD_COLORS = ['#378ADD', '#D4537E', '#639922', '#BA7517', '#7F77DD', '#1D9E75', '#D85A30'];
  const [newCardName, setNewCardName] = useState('');
  const [newCardColor, setNewCardColor] = useState(CARD_COLORS[0]);
  const [newCardCutoff, setNewCardCutoff] = useState('');
  const handleAddCard = () => {
    const nm = newCardName.trim();
    if (!nm) return;
    addCreditCard(nm, { color: newCardColor, cutoffDay: newCardCutoff === '' ? null : Number(newCardCutoff) });
    setNewCardName(''); setNewCardColor(CARD_COLORS[0]); setNewCardCutoff('');
  };
  const handleDeleteCard = async (id: string, name: string) => {
    if (isCardInUse(id)) { await askInfo('Bu kartın borç/taksit/faturası var. Silmeden önce bunları başka bir karta taşıyın veya silin.'); return; }
    if ((creditCards || []).length <= 1) { await askInfo('En az bir kredi kartı olmalı.'); return; }
    if (await askConfirmation(`"${name}" kartını silmek istediğinize emin misiniz?`)) deleteCreditCard(id);
  };
  const { username, avatar, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const initial = (username?.trim().charAt(0) || '?').toUpperCase();

  // Cihaz kilidi (biyometri) — cihaz-bazli, WebAuthn ile. Secure context (HTTPS/
  // Tailscale/localhost) + platform authenticator (parmak izi/Hello/Touch ID) sart.
  // Mobil/masaustu fark etmez; cihazda gercekten destek varsa kurulur.
  const deviceLockSupported = isDeviceLockSupported();
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false);
  const [deviceLockEnabled, setDeviceLockEnabled] = useState<boolean>(() => isDeviceLockEnabled());
  const [deviceLockBusy, setDeviceLockBusy] = useState(false);
  // Hesap-bazli: kilit gecikmesi ve "PIN kurulu mu" dogrudan hesap state'inden.
  const relockMinutes = lockRelockMinutes;
  const pinEnabled = !!lockPin;

  useEffect(() => {
    let alive = true;
    isPlatformAuthenticatorAvailable().then(v => { if (alive) setPlatformAuthAvailable(v); });
    return () => { alive = false; };
  }, []);

  const handleRelockChange = (n: number) => {
    setLockRelockMinutes(n);
  };

  const handleToggleDeviceLock = async () => {
    if (deviceLockBusy) return;
    if (deviceLockEnabled) {
      disableDeviceLock();
      setDeviceLockEnabled(false);
      await askInfo('Cihaz kilidi (parmak izi) kapatıldı.', 'Cihaz Kilidi');
      return;
    }
    setDeviceLockBusy(true);
    try {
      const ok = await registerDeviceLock(username);
      setDeviceLockEnabled(ok);
      if (ok) {
        await askInfo('Cihaz kilidi açıldı. Bu cihazda kilit ekranında parmak izi / cihaz kilidiyle de açabilirsiniz.', 'Cihaz Kilidi');
      } else {
        await askInfo('Cihaz kilidi kurulamadı. Cihazınızda parmak izi/yüz/Hello tanımlı olduğundan ve güvenli bağlantı (HTTPS / Tailscale / localhost) kullandığınızdan emin olun.', 'Cihaz Kilidi');
      }
    } finally {
      setDeviceLockBusy(false);
    }
  };

  // Uygulama PIN kilidi (HESAP-BAZLI; tum cihazlarda ayni PIN). Kilit ekrani
  // uygulamanin kendi temasinda.
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const closePinForm = () => {
    setPinFormOpen(false);
    setPinValue('');
    setPinConfirm('');
  };

  const handleSavePin = async () => {
    if (pinBusy) return;
    if (!/^\d{4,6}$/.test(pinValue)) {
      await askInfo("PIN 4-6 haneli rakamlardan oluşmalı.", "Uygulama PIN'i");
      return;
    }
    if (pinValue !== pinConfirm) {
      await askInfo("Girdiğiniz iki PIN eşleşmiyor.", "Uygulama PIN'i");
      return;
    }
    setPinBusy(true);
    try {
      const rec = await computePinRecord(pinValue);
      if (rec) {
        setLockPin(rec);
        closePinForm();
        await askInfo("Uygulama PIN'i ayarlandı. Bu PIN tüm cihazlarınızda geçerli.", "Uygulama PIN'i");
      } else {
        await askInfo("PIN kaydedilemedi. Tekrar deneyin.", "Uygulama PIN'i");
      }
    } finally {
      setPinBusy(false);
    }
  };

  const handleRemovePin = async () => {
    const ok = await askConfirmation("Uygulama PIN'i kaldırılsın mı? (Tüm cihazlarda)", "PIN'i Kaldır");
    if (!ok) return;
    setLockPin(null);
    closePinForm();
    await askInfo("Uygulama PIN'i kaldırıldı.", "Uygulama PIN'i");
  };

  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [secError, setSecError] = useState('');
  const [secSuccess, setSecSuccess] = useState('');
  const [isSecLoading, setIsSecLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isPwdLoading, setIsPwdLoading] = useState(false);
  
  const handleExport = () => {
    try {
      exportToExcel(state);
    } catch (error) {
      console.error("Yedek alınırken hata:", error);
      askInfo("Excel dosyası oluşturulurken bir hata meydana geldi.", "Yedekleme Hatası");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (await askConfirmation("Mevcut verilerinizin üzerine bu Excel yedeği yüklenecek. Emin misiniz?")) {
          const newState = await importFromExcel(file);
          loadState(newState);
          await askInfo("Excel yedeği başarıyla yüklendi!", "Yedek Yüklendi");
      }
    } catch (error) {
      console.error("Yedek yüklenirken hata oluştu:", error);
      await askInfo("Excel dosyası okunamadı veya formatı hatalı.", "Yedekleme Hatası");
    }

    // Reset file input
    e.target.value = '';
  };

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarMsg({ type: 'error', text: 'Lütfen bir resim dosyası seçin.' });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'Dosya çok büyük (en fazla 12 MB).' });
      return;
    }
    setAvatarMsg(null);
    setCropFile(file);
  };

  const handleCropSave = async (dataUrl: string) => {
    setCropFile(null);
    setAvatarLoading(true);
    setAvatarMsg(null);
    try {
      await updateAvatar(dataUrl);
      setAvatarMsg({ type: 'success', text: 'Profil fotoğrafı güncellendi.' });
    } catch (err: any) {
      setAvatarMsg({ type: 'error', text: err.message || 'Fotoğraf kaydedilemedi.' });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!avatar) return;
    if (!(await askConfirmation('Profil fotoğrafını kaldırmak istiyor musunuz?'))) return;
    setAvatarLoading(true);
    setAvatarMsg(null);
    try {
      await updateAvatar(null);
      setAvatarMsg({ type: 'success', text: 'Profil fotoğrafı kaldırıldı.' });
    } catch (err: any) {
      setAvatarMsg({ type: 'error', text: err.message || 'İşlem başarısız.' });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSetSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError('');
    setSecSuccess('');
    setIsSecLoading(true);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Oturum süresi dolmuş. Lütfen tekrar giriş yapın.");

      const res = await fetch(`${API_URL}/auth/set-security-question`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ securityQuestion, securityAnswer })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Güvenlik sorusu güncellenemedi.');
      }

      setSecSuccess('Güvenlik sorusu başarıyla güncellendi.');
      setSecurityQuestion('');
      setSecurityAnswer('');
    } catch (err: any) {
      setSecError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsSecLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!/^\d{6}$/.test(newPassword)) {
      setPwdError('Yeni şifre 6 haneli bir sayı olmalıdır (ör. 123456).');
      return;
    }

    setIsPwdLoading(true);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Oturum süresi dolmuş. Lütfen tekrar giriş yapın.");

      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Şifre güncellenemedi.');
      }

      setPwdSuccess('Şifreniz başarıyla değiştirildi.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwdError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <header className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Geri"
          className="md:hidden p-2 -ml-2 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Ayarlar</h1>
      </header>

      <Card title="Hesap">
        <div className="p-2 space-y-3">
          {avatarMsg && (
            <div className={cn(
              "p-3 rounded-lg text-sm flex items-center gap-2",
              avatarMsg.type === 'error' ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
            )}>
              {avatarMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {avatarMsg.text}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={avatar} initial={initial} className="w-14 h-14 text-xl" />
              <div className="min-w-0">
                <div className="font-medium truncate">{username || 'Bilinmiyor'}</div>
                <div className="text-xs text-muted-foreground">Giriş yapılan kullanıcı</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                <Camera size={16} />
                <span className="hidden sm:inline">{avatar ? 'Değiştir' : 'Fotoğraf ekle'}</span>
              </button>
              {avatar && (
                <button
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  aria-label="Fotoğrafı kaldır"
                  className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          <input
            type="file"
            ref={avatarInputRef}
            onChange={handleAvatarPick}
            accept="image/*"
            className="hidden"
          />
        </div>
      </Card>

      <Card title="Güvenlik">
          <form onSubmit={handleSetSecurityQuestion} className="space-y-4 p-2">
            {secError && (
              <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {secError}
              </div>
            )}
            {secSuccess && (
              <div className="p-3 bg-green-500/10 text-green-500 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 size={16} />
                {secSuccess}
              </div>
            )}

            <p className="text-xs text-muted-foreground">Şifrenizi unutmanız durumunda sıfırlayabilmek için bir güvenlik sorusu ve cevabı belirleyin.</p>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Güvenlik Sorusu</label>
              <input
                type="text"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Örn: İlk evcil hayvanınızın adı?"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Cevabınız</label>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Cevabınız..."
              />
            </div>

            <button
              type="submit"
              disabled={isSecLoading}
              className="w-full py-2 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              {isSecLoading ? 'Kaydediliyor...' : <><KeyRound size={18} /> Güvenlik Sorusunu Kaydet</>}
            </button>
          </form>

          <div className="mt-8 mb-4 border-t border-border"></div>

          <form onSubmit={handleChangePassword} className="space-y-4 p-2">
            {pwdError && (
              <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="p-3 bg-green-500/10 text-green-500 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle2 size={16} />
                {pwdSuccess}
              </div>
            )}

            <p className="text-xs text-muted-foreground font-medium mb-2">Şifre Değiştir</p>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Mevcut Şifre</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Yeni Şifre</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary tracking-[0.3em]"
                placeholder="••••••"
              />
              <p className="text-xs text-muted-foreground">6 haneli bir sayı.</p>
            </div>

            <button
              type="submit"
              disabled={isPwdLoading}
              className="w-full py-2 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isPwdLoading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
            </button>
          </form>
      </Card>

      <Card title="Görünüm ve Özellikler">
        <div className="space-y-4 p-2">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                      <CreditCard size={20} />
                  </div>
                  <div>
                      <div className="font-medium">Yemek Kartı</div>
                      <div className="text-xs text-muted-foreground">Yemek kartı geliri ve harcamalarını takip et</div>
                  </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={showMealCard}
                      onChange={toggleShowMealCard}
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
          </div>

          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500">
                      <Download size={20} className="rotate-180" />
                  </div>
                  <div>
                      <div className="font-medium">Kasa Bölümü</div>
                      <div className="text-xs text-muted-foreground">Varlıklarım sayfasında altın/döviz kasası bölümünü göster</div>
                  </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={showVault}
                      onChange={toggleShowVault}
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
          </div>

          {/* Uygulama PIN'i — HESAP-BAZLI: tek PIN, tum cihazlarda ayni (senkron). */}
          <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                      <KeyRound size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-medium">Uygulama PIN'i</div>
                      <div className="text-xs text-muted-foreground">
                        {pinEnabled
                          ? 'PIN kurulu — tüm cihazlarınızda aynı. Kendi temanızda sorulur.'
                          : '4-6 haneli tek PIN; tüm cihazlarınızda geçerli (kendi temanızda, Google/OS ekranı yok).'}
                      </div>
                  </div>
              </div>
              <div className="shrink-0">
                {pinEnabled ? (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                  >
                    Kaldır
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPinFormOpen(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/70 transition-colors"
                  >
                    {pinFormOpen ? 'Vazgeç' : 'Belirle'}
                  </button>
                )}
              </div>
          </div>

          {pinFormOpen && !pinEnabled && (
            <div className="flex flex-col gap-2 pl-11">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="PIN (4-6 hane)"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                placeholder="PIN (tekrar)"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleSavePin}
                disabled={pinBusy}
                className="self-start px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-60"
              >
                {pinBusy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}

          {/* Kilit hangi cihaz tipinde aktif olsun (HESAP-BAZLI; her cihazdan set
              edilir, hepsine yansir). PIN veya parmak izi kuruluysa devreye girer. */}
          <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                      <Lock size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-medium">Kilit nerede aktif?</div>
                      <div className="text-xs text-muted-foreground">
                        Mobil ve masaüstü için ayrı ayrı aç/kapa. (PIN veya parmak izi kuruluysa çalışır.)
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="accent-primary w-4 h-4" checked={lockOnMobile} onChange={(e) => setLockOnMobile(e.target.checked)} />
                  Mobil
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" className="accent-primary w-4 h-4" checked={lockOnDesktop} onChange={(e) => setLockOnDesktop(e.target.checked)} />
                  Masaüstü
                </label>
              </div>
          </div>

          {/* Parmak izi ile aç — biyometri (CIHAZ-YEREL; WebAuthn senkronlanamaz). */}
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                      <Fingerprint size={20} />
                  </div>
                  <div>
                      <div className="font-medium">Parmak izi ile aç</div>
                      <div className="text-xs text-muted-foreground">
                        {!deviceLockSupported
                          ? 'Biyometri için güvenli bağlantı (HTTPS / Tailscale / localhost) gerekli.'
                          : !platformAuthAvailable
                          ? 'Bu cihazda parmak izi / Windows Hello / Touch ID bulunamadı.'
                          : 'Kilit ekranında parmak izi / cihaz kilidiyle de aç (yalnız bu cihaz).'}
                      </div>
                  </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                  <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={deviceLockEnabled}
                      onChange={handleToggleDeviceLock}
                      disabled={deviceLockBusy || (!deviceLockEnabled && (!deviceLockSupported || !platformAuthAvailable))}
                  />
                  <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
              </label>
          </div>

          {/* Kilit gecikmesi (kullanilmazsa) — kilit bir cihaz tipinde aciksa.
              Hesap-bazli; hem arka plan hem soguk baslatma (acilis) icin gecerli. */}
          {(lockOnMobile || lockOnDesktop) && (
            <div className="flex items-center gap-2 flex-wrap pl-11">
              <span className="text-xs text-muted-foreground">Kullanmazsam kilitle:</span>
              <select
                value={relockMinutes}
                onChange={(e) => handleRelockChange(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-secondary text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={0}>Hemen</option>
                <option value={1}>1 dakika sonra</option>
                <option value={5}>5 dakika sonra</option>
                <option value={15}>15 dakika sonra</option>
              </select>
            </div>
          )}
        </div>
      </Card>

      <Card title="Kredi Kartlarım">
        <p className="text-xs text-muted-foreground mb-3">
          Bilanço'da tek toplam görünür; her kart Borç sayfasında ayrışır ve kendi hesap kesim gününe göre çalışır (kesim: bu günden sonraki harcamalar bir sonraki ayın ekstresine yazılır).
        </p>
        <div className="space-y-2">
          {(creditCards || []).map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40 border border-border">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color || '#888' }} />
              <input
                value={c.name}
                onChange={(e) => updateCreditCard(c.id, { name: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none"
                aria-label="Kart adı"
              />
              <select
                value={c.cutoffDay ?? ''}
                onChange={(e) => updateCreditCard(c.id, { cutoffDay: e.target.value === '' ? null : Number(e.target.value) })}
                className="px-2 py-1.5 rounded-lg bg-secondary text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
                aria-label="Kesim günü"
              >
                <option value="">Kesim yok</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Her ayın {ayinGunu(d)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleDeleteCard(c.id, c.name)}
                title="Kartı sil"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="text-xs text-muted-foreground">Yeni kart</div>
          <div className="flex items-center gap-2">
            <input
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              placeholder="Kart adı (ör. Bonus)"
              className="flex-1 min-w-0 px-3 h-10 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={newCardCutoff}
              onChange={(e) => setNewCardCutoff(e.target.value)}
              className="px-2 h-10 rounded-xl bg-secondary text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
              aria-label="Yeni kart kesim günü"
            >
              <option value="">Kesim yok</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Her ayın {ayinGunu(d)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1 flex-wrap">
              {CARD_COLORS.map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setNewCardColor(col)}
                  aria-label="Renk"
                  className={`w-6 h-6 rounded-full shrink-0 ${newCardColor === col ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                  style={{ background: col }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddCard}
              disabled={!newCardName.trim()}
              className="px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 shrink-0"
            >
              Kart Ekle
            </button>
          </div>
        </div>
      </Card>

      <Card title="Excel Veri Yönetimi">
        <div className="flex gap-4 mt-2">
           <button
             onClick={handleExport}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <div className="bg-green-100 p-3 rounded-full dark:bg-green-900/30">
               <Download size={24} className="text-green-600 dark:text-green-400" />
             </div>
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-foreground">Yedek İndir</span>
                <span className="text-xs text-muted-foreground">.xlsx formatında</span>
             </div>
           </button>

           <button
             onClick={handleImportClick}
             className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
           >
             <div className="bg-blue-100 p-3 rounded-full dark:bg-blue-900/30">
                <Upload size={24} className="text-blue-600 dark:text-blue-400" />
             </div>
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-foreground">Yedek Yükle</span>
                <span className="text-xs text-muted-foreground">.xlsx formatında</span>
             </div>
           </button>
           <input
             type="file"
             ref={fileInputRef}
             onChange={handleFileChange}
             accept=".xlsx, .xls"
             className="hidden"
           />
        </div>
      </Card>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}
