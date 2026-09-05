/**
 * Uygulama PIN kilidi — HESAP-BAZLI. PIN kaydi (salt+hash) BudgetState'te tutulur
 * ve tum cihazlarda senkrondur (bkz. BudgetContext lockPin). Bu dosya yalnizca
 * SAF hash yardimcilaridir: kayit uretir (computePinRecord) ve dogrular
 * (verifyPinAgainst) — localStorage KULLANMAZ. PIN duz saklanmaz: rastgele salt +
 * hash (secure context'te SHA-256, aksi halde saf-JS hash). Kolaylik kilididir.
 */

export interface PinRecord {
  salt: string;
  hash: string;
  len: number;
}

// String -> ArrayBuffer-tabanli Uint8Array (crypto.subtle.digest BufferSource ister).
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

/** Girilen PIN'den saklanacak kaydi uretir (4-6 hane). Gecersizse null. */
export async function computePinRecord(pin: string): Promise<PinRecord | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;
  try {
    const salt = randHex();
    const hash = await hashPin(pin, salt);
    return { salt, hash, len: pin.length };
  } catch {
    return null;
  }
}

/** Girilen PIN, verilen kayitla eslesiyor mu? */
export async function verifyPinAgainst(pin: string, record: PinRecord | null | undefined): Promise<boolean> {
  if (!record) return false;
  try {
    const hash = await hashPin(pin, record.salt);
    return hash === record.hash;
  } catch {
    return false;
  }
}
