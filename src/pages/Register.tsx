import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api';
import { Card } from '../components/ui/Card';
import { UserPlus, AlertCircle } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Şifreler eşleşmiyor.');
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kayıt yapılamadı.');
      }

      login(data.token, data.username);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Hesabını Bil!</h1>
          <p className="text-muted-foreground">Kendi bütçenizi yönetmek için hesap oluşturun.</p>
        </div>

        <Card title="Hesap Oluştur">
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

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Şifreyi Onayla</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isLoading ? 'Hesap oluşturuluyor...' : <><UserPlus size={20} /> Kayıt Ol</>}
            </button>
          </form>
        </Card>

        <p className="text-center mt-6 text-muted-foreground text-sm">
          Zaten hesabınız var mı? <Link to="/login" className="text-primary hover:underline font-medium">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}
