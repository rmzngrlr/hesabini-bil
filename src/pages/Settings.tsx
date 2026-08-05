import { useRef, useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth, getAuthToken } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { AvatarCropModal } from '../components/AvatarCropModal';
import { Download, Upload, CreditCard, KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Camera, Trash2, CalendarClock } from 'lucide-react';
import { exportToExcel, importFromExcel } from '../services/excelService';
import { API_URL } from '../services/api';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { state, loadState, showMealCard, toggleShowMealCard, showVault, toggleShowVault, askConfirmation, statementCutoffDay, setStatementCutoffDay } = useBudget();
  const { username, avatar, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const initial = (username?.trim().charAt(0) || '?').toUpperCase();
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
      alert("Excel dosyası oluşturulurken bir hata meydana geldi.");
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
          alert("Excel yedeği başarıyla yüklendi!");
      }
    } catch (error) {
      console.error("Yedek yüklenirken hata oluştu:", error);
      alert("Excel dosyası okunamadı veya formatı hatalı.");
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
    <div className="space-y-6 pb-20">
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
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Yeni Şifre</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
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
                      <div className="font-medium">Kasa Menüsü</div>
                      <div className="text-xs text-muted-foreground">Altın ve diğer varlıkları takip etme menüsünü göster</div>
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
        </div>
      </Card>

      <Card title="Kredi Kartı">
        <div className="flex items-center justify-between gap-3 p-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-full bg-purple-500/10 text-purple-500">
              <CalendarClock size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-medium">Hesap Kesim Günü</div>
              <div className="text-xs text-muted-foreground">
                Bu günden sonra yapılan harcamalar bir sonraki ayın ekstresine yazılır.
              </div>
            </div>
          </div>
          <select
            value={statementCutoffDay ?? ''}
            onChange={(e) => setStatementCutoffDay(e.target.value === '' ? null : Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
            aria-label="Hesap kesim günü"
          >
            <option value="">Kapalı</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>Her ayın {d}'i</option>
            ))}
          </select>
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
