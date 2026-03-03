import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import { LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await res.json();
            throw new Error(data.error || 'Giriş yapılamadı.');
        } else {
            throw new Error(`Sunucu hatası: ${res.status} ${res.statusText}`);
        }
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await res.json();
          login(data.token, data.username);
          navigate('/');
      } else {
          throw new Error('Sunucudan geçersiz bir yanıt alındı.');
      }
    } catch (err: any) {
      setError(err.message || 'Beklenmeyen bir hata oluştu. Sunucu çalışmıyor olabilir.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Hesabını Bil!</h1>
          <p className="text-muted-foreground">Bütçenize erişmek için giriş yapın.</p>
        </div>

      <Card title="Giriş Yap">
          <form onSubmit={handleSubmit} className="space-y-4 p-2">
            {error && (
              <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Kullanıcı adınız"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Giriş yapılıyor...' : <><LogIn size={20} /> Giriş Yap</>}
            </button>
          </form>
        </Card>

        <p className="text-center mt-6 text-muted-foreground text-sm">
          Hesabınız yok mu? <Link to="/register" className="text-primary hover:underline font-medium">Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}
