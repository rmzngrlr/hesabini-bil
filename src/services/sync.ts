/*
 * Hesabını Bil! — Cihazlar arası canlı senkron istemcisi (SSE).
 *
 * Sunucu, kullanıcının bir cihazı veri değiştirdiğinde diğer cihazlara "değişti"
 * sinyali gönderir (bkz. server/src/sse.ts). Burada o sinyali dinleyip ilgili
 * veriyi bir kez yeniden çekmesi için handler'ı tetikliyoruz.
 *
 * EventSource özel başlık gönderemediğinden önce tek-kullanımlık bilet alınır
 * (POST /budget/stream-ticket), sonra bilet URL'de kullanılarak akışa bağlanılır.
 * Bilet tek kullanımlık olduğu için otomatik yeniden bağlanmayı ELLE yönetiriz.
 */
import { API_URL, fetchWithAuth, getTabId } from './api';

export type SyncScope = 'budget' | 'vault' | 'all';
export type SyncEvent = { scope?: SyncScope };
type Handler = (ev: SyncEvent) => void;

let es: EventSource | null = null;
let handler: Handler | null = null;
let reconnectTimer: number | null = null;
let backoff = 2000;
let started = false;
let openedOnce = false;
let stopped = false;

const clearReconnect = () => {
  if (reconnectTimer != null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const closeEs = () => {
  if (es) {
    try { es.close(); } catch { /* yoksay */ }
    es = null;
  }
};

const scheduleReconnect = () => {
  clearReconnect();
  if (stopped) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  reconnectTimer = window.setTimeout(() => void connect(), backoff);
  backoff = Math.min(backoff * 2, 30000);
};

const connect = async () => {
  clearReconnect();
  if (stopped) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  closeEs();

  let ticket = '';
  try {
    const res = await fetchWithAuth('/budget/stream-ticket', { method: 'POST' });
    if (!res.ok) throw new Error('ticket alınamadı');
    ticket = (await res.json()).ticket;
  } catch {
    scheduleReconnect();
    return;
  }
  if (stopped) return;

  const url = `${API_URL}/budget/stream?ticket=${encodeURIComponent(ticket)}&tab=${encodeURIComponent(getTabId())}`;
  const source = new EventSource(url);
  es = source;

  source.onopen = () => {
    backoff = 2000;
    // Yeniden bağlandıysak (ilk bağlanış değil), bağlı olmadığımız sürede
    // kaçırmış olabileceğimiz değişiklikleri yakalamak için tam tazeleme iste.
    if (openedOnce) handler?.({ scope: 'all' });
    openedOnce = true;
  };

  source.onmessage = (e) => {
    try {
      const data = e.data ? JSON.parse(e.data) : {};
      handler?.(data);
    } catch {
      /* yoksay */
    }
  };

  source.onerror = () => {
    // Tek-kullanımlık biletle EventSource kendi başına yeniden bağlanamaz.
    if (es === source) es = null;
    try { source.close(); } catch { /* yoksay */ }
    scheduleReconnect();
  };
};

const onVisibility = () => {
  if (typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  // Uygulamaya geri dönüldü: hemen bir yakalama tazelemesi + gerekiyorsa bağlan.
  handler?.({ scope: 'all' });
  if (!es || es.readyState !== EventSource.OPEN) void connect();
};

export const startSync = (h: Handler): void => {
  handler = h;
  stopped = false;
  if (started) return;
  started = true;
  openedOnce = false;
  backoff = 2000;
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
  void connect();
};

export const stopSync = (): void => {
  stopped = true;
  started = false;
  handler = null;
  clearReconnect();
  closeEs();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
};
