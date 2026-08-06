import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_URL } from '../services/api';

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  avatar: string | null;
  isAuthenticated: boolean;
  login: (token: string, username: string, isAdmin?: boolean, avatar?: string | null) => void;
  logout: () => void;
  updateAvatar: (avatar: string | null) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for token on mount
    const storedToken = localStorage.getItem('budget_token');
    const storedUsername = localStorage.getItem('budget_username');
    const storedIsAdmin = localStorage.getItem('budget_is_admin') === 'true';
    const storedAvatar = localStorage.getItem('budget_avatar');

    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsAdmin(storedIsAdmin);
      if (storedAvatar) setAvatar(storedAvatar);

      // Avatari sunucudan tazele (baska cihazda degismis olabilir). Cevrimdisi ise localStorage degeri kalir.
      fetch(`${API_URL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data && 'avatar' in data) {
            const a: string | null = data.avatar || null;
            setAvatar(a);
            if (a) localStorage.setItem('budget_avatar', a);
            else localStorage.removeItem('budget_avatar');
          }
        })
        .catch(() => { /* baglanti yok; mevcut degeri koru */ });
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUsername: string, newIsAdmin: boolean = false, newAvatar: string | null = null) => {
    localStorage.setItem('budget_token', newToken);
    localStorage.setItem('budget_username', newUsername);
    localStorage.setItem('budget_is_admin', String(newIsAdmin));
    if (newAvatar) localStorage.setItem('budget_avatar', newAvatar);
    else localStorage.removeItem('budget_avatar');
    // Iki adimli giris icin son kullaniciyi hatirla (cikista SILINMEZ).
    localStorage.setItem('budget_last_user', JSON.stringify({ username: newUsername, avatar: newAvatar || null }));
    setToken(newToken);
    setUsername(newUsername);
    setIsAdmin(newIsAdmin);
    setAvatar(newAvatar);
  };

  const logout = () => {
    localStorage.removeItem('budget_token');
    localStorage.removeItem('budget_username');
    localStorage.removeItem('budget_is_admin');
    localStorage.removeItem('budget_avatar');
    setToken(null);
    setUsername(null);
    setIsAdmin(false);
    setAvatar(null);
    // Reload to clear state
    window.location.href = '/login';
  };

  const updateAvatar = async (newAvatar: string | null) => {
    const t = token || localStorage.getItem('budget_token');
    if (!t) throw new Error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');

    const res = await fetch(`${API_URL}/auth/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t}`
      },
      body: JSON.stringify({ avatar: newAvatar })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Profil fotoğrafı güncellenemedi.');

    setAvatar(newAvatar);
    if (newAvatar) localStorage.setItem('budget_avatar', newAvatar);
    else localStorage.removeItem('budget_avatar');
    // Hatirlanan kullanicinin avatarini da tazele.
    const uname = username || localStorage.getItem('budget_username');
    if (uname) localStorage.setItem('budget_last_user', JSON.stringify({ username: uname, avatar: newAvatar || null }));
  };

  return (
    <AuthContext.Provider value={{
      token,
      username,
      isAdmin,
      avatar,
      isAuthenticated: !!token,
      login,
      logout,
      updateAvatar,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utility function to easily get the token outside of React hooks
export const getAuthToken = () => {
  return localStorage.getItem('budget_token');
};

export interface LastUser {
  username: string;
  avatar: string | null;
}

// Iki adimli girisin ilk adiminda gosterilen "son giren kullanici" (localStorage).
export const getLastUser = (): LastUser | null => {
  try {
    const raw = localStorage.getItem('budget_last_user');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.username === 'string') {
      return { username: p.username, avatar: p.avatar || null };
    }
    return null;
  } catch {
    return null;
  }
};
