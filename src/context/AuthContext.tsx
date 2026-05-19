import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (token: string, username: string, isAdmin?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for token on mount
    const storedToken = localStorage.getItem('budget_token');
    const storedUsername = localStorage.getItem('budget_username');
    const storedIsAdmin = localStorage.getItem('budget_is_admin') === 'true';

    if (storedToken && storedUsername) {
      setToken(storedToken);
      setUsername(storedUsername);
      setIsAdmin(storedIsAdmin);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUsername: string, newIsAdmin: boolean = false) => {
    localStorage.setItem('budget_token', newToken);
    localStorage.setItem('budget_username', newUsername);
    localStorage.setItem('budget_is_admin', String(newIsAdmin));
    setToken(newToken);
    setUsername(newUsername);
    setIsAdmin(newIsAdmin);
  };

  const logout = () => {
    localStorage.removeItem('budget_token');
    localStorage.removeItem('budget_username');
    localStorage.removeItem('budget_is_admin');
    setToken(null);
    setUsername(null);
    setIsAdmin(false);
    // Reload to clear state
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      token,
      username,
      isAdmin,
      isAuthenticated: !!token,
      login,
      logout,
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
