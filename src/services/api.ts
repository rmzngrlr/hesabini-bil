export const API_URL = '/api';

// Bu uygulama örneği (cihaz/sekme) için kalıcı iç kimlik. Canlı senkronda
// sunucu, değişikliği YAPAN cihazı bu id ile ayırıp ona echo göndermez.
// sessionStorage: her açık uygulama bağlamına özel, yeniden yüklemede kalıcı.
let _tabId = '';
export const getTabId = (): string => {
  if (_tabId) return _tabId;
  try {
    const KEY = 'budget_tab_id';
    let v = sessionStorage.getItem(KEY);
    if (!v) {
      v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-' + Date.now();
      sessionStorage.setItem(KEY, v);
    }
    _tabId = v;
  } catch {
    _tabId = Math.random().toString(36).slice(2);
  }
  return _tabId;
};

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('budget_token');

  const headers = {
    'Content-Type': 'application/json',
    'X-Tab-Id': getTabId(),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('budget_token');
    localStorage.removeItem('budget_username');
    window.location.href = '/login';
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
  }

  return response;
};
