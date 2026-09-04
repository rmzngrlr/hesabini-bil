/**
 * Uygulamaya ozel PIN kilidi — tamamen istemci tarafli, cihaz-bazli. Telefonun
 * biyometrisi DEGIL; uygulamanin kendi temasinda 4-6 haneli kod. HTTP ve HTTPS'te
 * calisir (secure context gerekmez). PIN duz saklanmaz: rastgele salt + hash
 * (secure context'te SHA-256, aksi halde saf-JS hash) localStorage'da tutulur.
 * Bu bir KOLAYLIK kilididir (localStorage cihazda erisilebilir); amac telefonu
 * eline alan birinin uygulamayi casually acmasini engellemek.
 */

const PIN_KEY = 'device_lock_pin';

// String -> ArrayBuffer-tabanli Uint8Array (crypto.subtle.digest BufferSource ister;
// yeni TS lib'inde Uint8Array<ArrayBufferLike> uymadigi icin acikca ArrayBuffer baglanir).
function strToBytes(s: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(src.length));
  out.set(src);
  return out;
}

function randHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  try {
    crypto.getRandomValues(a);
  } catch {
    for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Secure context yoksa (HTTP) kullanilan saf-JS hash (cyrb53).
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = `${salt}:${pin}`;
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const buf = await subtle.digest('SHA-256', strToBytes(data));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      /* fallback'e dus */
    }
  }
  return 'j' + cyrb53(data); // 'j' prefix: JS-hash oldugunu isaretler
}

interface StoredPin {
  salt: string;
  hash: string;
  len: number;
}

function readStored(): StoredPin | null {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<StoredPin>;
    if (typeof o.salt === 'string' && typeof o.hash === 'string' && typeof o.len === 'number') {
      return { salt: o.salt, hash: o.hash, len: o.len };
    }
    return null;
  } catch {
    return null;
  }
}

/** Bu cihazda PIN kurulu mu? */
export function isPinEnabled(): boolean {
  return readStored() !== null;
}

/** Kurulu PIN'in uzunlugu (kilit ekranindaki nokta sayisi). Yoksa 0. */
export function getPinLength(): number {
  const s = readStored();
  return s ? s.len : 0;
}

/** PIN belirle/degistir. 4-6 hane. Basarili olursa true. */
export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  try {
    const salt = randHex();
    const hash = await hashPin(pin, salt);
    const stored: StoredPin = { salt, hash, len: pin.length };
    localStorage.setItem(PIN_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

/** Girilen PIN dogru mu? */
export async function verifyPin(pin: string): Promise<boolean> {
  const s = readStored();
  if (!s) return false;
  try {
    const hash = await hashPin(pin, s.salt);
    return hash === s.hash;
  } catch {
    return false;
  }
}

/** PIN'i kaldir. */
export function disablePin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    /* yoksay */
  }
}
