import { API_URL } from './api';

/**
 * Web Push istemci yardımcıları.
 * - Abonelik VAPID public key ile yapılır (sunucudan /push/public-key ile alınır).
 * - Abonelik sunucuya kaydedilir; ilk abonelikte sunucu deneme bildirimi gönderir.
 * - Hatırlatıcılar (vade mantığı istemcide) sunucuya eşitlenir; sunucu vadesi gelince
 *   uygulama kapalı olsa bile push gönderir.
 */

export interface ReminderIntent {
  key: string;
  title: string;
  body: string;
  url: string;
  fireAt: number; // epoch ms
}

const jsonHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('budget_token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const pushPermission = (): NotificationPermission =>
  typeof Notification !== 'undefined' ? Notification.permission : 'denied';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Mevcut cihazda aktif (abone + izin verilmiş) mi? */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || pushPermission() !== 'granted') return false;
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export type EnableResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'no-sw' | 'no-key' | 'server' | 'error' };

/** Bildirimleri aç: izin iste, push'a abone ol, sunucuya kaydet (ilk seferde deneme bildirimi gelir). */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await getRegistration();
    if (!reg) return { ok: false, reason: 'no-sw' };

    const keyRes = await fetch(`${API_URL}/push/public-key`);
    const keyData = await keyRes.json().catch(() => ({}));
    const publicKey: string | undefined = keyData?.publicKey;
    if (!publicKey) return { ok: false, reason: 'no-key' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // NOT: Yeni TS/lib.dom'da Uint8Array artik Uint8Array<ArrayBufferLike>; applicationServerKey
      // ise BufferSource (ArrayBuffer tabanli) bekliyor. Deger calisma zamaninda gecerli bir
      // BufferSource; tip uyusmazligini cift-assertion ile asiyoruz.
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
    });
    if (!res.ok) return { ok: false, reason: 'server' };
    return { ok: true };
  } catch (e) {
    console.error('enablePush hatası:', e);
    return { ok: false, reason: 'error' };
  }
}

/** Bildirimleri kapat: aboneliği sunucudan sil ve tarayıcıdan kaldır. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      try {
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch {
        /* yoksay */
      }
      try {
        await sub.unsubscribe();
      } catch {
        /* yoksay */
      }
    }
  } catch (e) {
    console.error('disablePush hatası:', e);
  }
}

/** Elle test bildirimi gönder (Ayarlar butonu). */
export async function sendTestPush(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/push/test`, { method: 'POST', headers: jsonHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

/** Hatırlatıcıları sunucuya eşitle. İzin yoksa/abone değilse sessizce çık. */
export async function syncReminders(reminders: ReminderIntent[]): Promise<void> {
  if (!pushSupported() || pushPermission() !== 'granted') return;
  try {
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    await fetch(`${API_URL}/push/sync-reminders`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ reminders }),
    });
  } catch {
    /* yoksay */
  }
}
