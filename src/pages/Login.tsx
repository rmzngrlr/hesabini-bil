import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, getLastUser } from '../context/AuthContext';
import { API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { LogIn, AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'welcome' | 'input'>(() => (getLastUser() ? 'welcome' : 'input'));
  const [username, setUsername] = useState(() => getLastUser()?.username ?? '');
  const [avatar, setAvatar] = useState<string | null>(() => getLastUser()?.avatar ?? null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const initial = (username?.trim().charAt(0) || '?').toUpperCase();

  // Adim 1 -> 2: kullaniciyi tani (lookup) ve avatarini getir.
  const handleContinue = async (uname: string) => {
    const u = uname.trim();
    if (!u) { setError('Kullanıcı adı gerekli.'); return; }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/lookup/${encodeURIComponent(u)}`);
      if (res.status === 404) {
        setError('Böyle bir kullanıcı bulunamadı.');
        return;
      }
      if (!res.ok) throw new Error('Sunucuya ulaşılamadı.');
      const data = await res.json();
      setUsername(data.username);
      setAvatar(data.avatar || null);
      setPassword('');
      setShowPassword(false);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.error || 'Giriş yapılamadı.');
        }
        throw new Error(`Sunucu hatası: ${res.status} ${res.statusText}`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Sunucudan geçersiz bir yanıt alındı.');
      }

      const data = await res.json();
      login(data.token, data.username, data.isAdmin, data.avatar);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu. Sunucu çalışmıyor olabilir.');
    } finally {
      setIsLoading(false);
    }
  };

  const useDifferentAccount = () => {
    setMode('input');
    setUsername('');
    setAvatar(null);
    setError('');
  };

  const backToStep1 = () => {
    setStep(1);
    setPassword('');
    setShowPassword(false);
    setError('');
    const last = getLastUser();
    setMode(last && last.username === username ? 'welcome' : 'input');
  };

  const returnToRemembered = () => {
    const last = getLastUser();
    if (last) {
      setUsername(last.username);
      setAvatar(last.avatar);
      setMode('welcome');
      setError('');
    }
  };

  const hasLastUser = !!getLastUser();

  return (
    <div className="app-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[700px]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Hesabını Bil!</h1>
          <p className="text-muted-foreground">Bütçenize erişmek için giriş yapın.</p>
        </div>

        <Card>
          <div className="space-y-4 p-2">
            {error && (
              <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {step === 1 ? (
              mode === 'welcome' ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <Avatar src={avatar} initial={initial} className="w-20 h-20 text-2xl" />
                  <div className="text-lg font-semibold text-center">Tekrar Hoş Geldin, {username}</div>
                  <button
                    onClick={() => handleContinue(username)}
                    disabled={isLoading}
                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Devam ediliyor...' : <>Devam <ArrowRight size={20} /></>}
                  </button>
                  <button onClick={useDifferentAccount} className="text-sm text-primary hover:underline mt-4">
                    Farklı hesapla giriş yap
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleContinue(username); }} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                      autoFocus
                      required
                      className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Kullanıcı adınız"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Kontrol ediliyor...' : <>Devam <ArrowRight size={20} /></>}
                  </button>
                  {hasLastUser && (
                    <button type="button" onClick={returnToRemembered} className="w-full text-sm text-primary hover:underline">
                      ← Kayıtlı kullanıcıya dön
                    </button>
                  )}
                </form>
              )
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={backToStep1} aria-label="Geri" className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar src={avatar} initial={initial} className="w-10 h-10 text-sm" />
                  <div className="font-semibold">{username}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Şifre</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoFocus
                      required
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary tracking-[0.3em]"
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end w-full">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">Şifremi Unuttum</Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Giriş yapılıyor...' : <><LogIn size={20} /> Giriş Yap</>}
                </button>
              </form>
            )}
          </div>
        </Card>

        {step === 1 && (
          <p className="text-center mt-6 text-muted-foreground text-sm">
            Hesabınız yok mu? <Link to="/register" className="text-primary hover:underline font-medium">Kayıt Ol</Link>
          </p>
        )}
      </div>
    </div>
  );
}
