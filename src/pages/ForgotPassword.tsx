import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import { KeyRound, AlertCircle, CheckCircle2, UserCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/security-question/${username}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Soru getirilemedi.');
      }

      setSecurityQuestion(data.question);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(newPassword)) {
      setError('Yeni şifre 6 haneli bir sayı olmalıdır (ör. 123456).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, securityAnswer, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Şifre sıfırlanamadı.');
      }

      setSuccess('Şifreniz başarıyla sıfırlandı. Giriş sayfasına yönlendiriliyorsunuz...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[700px]">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Şifremi Unuttum</h1>
          <p className="text-muted-foreground">Hesabınıza yeniden erişim sağlayın.</p>
        </div>

        <Card title={step === 1 ? "Kullanıcı Adı" : "Yeni Şifre Belirle"}>
          {error && (
            <div className="p-3 mb-4 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 mb-4 bg-green-500/10 text-green-500 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleFetchQuestion} className="space-y-4 p-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Kullanıcı Adı</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Kullanıcı adınız"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isLoading ? 'Kontrol ediliyor...' : 'Devam Et'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 p-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Güvenlik Sorusu</label>
                <div className="p-3 bg-secondary rounded-xl text-foreground font-medium">
                  {securityQuestion}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Cevabınız</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Cevap..."
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

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-secondary text-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
                >
                  Geri
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Sıfırlanıyor...' : <><KeyRound size={20} /> Şifreyi Sıfırla</>}
                </button>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center mt-6 text-muted-foreground text-sm">
          Şifrenizi hatırladınız mı? <Link to="/login" className="text-primary hover:underline font-medium">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}
