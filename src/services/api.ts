export const API_URL = '/api';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('budget_token');

  const headers = {
    'Content-Type': 'application/json',
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
