import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PrivacyContextType {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const STORAGE_KEY = 'privacy_hide_values';

/**
 * Deger gizleme (••••) modu. Cihaz-bazli tercih (localStorage), hesaba senkron
 * EDILMEZ; tema deseninin aynisi. Varsayilan: kapali (degerler gorunur).
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* yoksay */ }
  }, []);

  const toggle = useCallback(() => {
    setHiddenState(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* yoksay */ }
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle, setHidden }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
