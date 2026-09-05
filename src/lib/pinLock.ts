/**
 * Uygulama PIN kilidi — HESAP-BAZLI. PIN kaydi (salt+hash) BudgetState'te tutulur
 * ve tum cihazlarda senkrondur (bkz. BudgetContext lockPin). Bu dosya yalnizca
 * SAF hash yardimcilaridir: kayit uretir (computePinRecord) ve dogrular
 * (verifyPinAgainst) — localStorage KULLANMAZ. PIN duz saklanmaz: rastgele salt +
 * SHA-256. Hash TUM CIHAZLARDA AYNI olmali (kayit senkron): secure context'te
 * crypto.subtle, degilse birebir ayni ciktiyi veren saf-JS SHA-256 kullanilir —
 * boylece mobil (HTTPS) ile masaustu (HTTP/LAN-IP) ayni PIN icin ayni hash uretir.
 * (Eski 'j' onekli cyrb53 kayitlari da geriye donuk dogrulanir.) Kolaylik kilididir.
 */

export interface PinRecord {
  salt: string;
  hash: string;
  len: number;
}

// String -> ArrayBuffer-tabanli Uint8Array (crypto.subtle.digest BufferSource ister,
// saf-JS SHA-256 de ayni baytlari kullansin diye tek kaynak).
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

// Saf-JS SHA-256 (secure context / crypto.subtle olmayan cihazlar icin). crypto.subtle
// SHA-256 ile BAYT-BAZINDA AYNI ciktiyi verir; boylece hangi cihazda uretildiginden
// bagimsiz olarak dogrulama tutar. Bilinen test vektorleriyle dogrulandi.
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256HexJs(bytes: Uint8Array): string {
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const l = bytes.length;
  const bitLen = l * 8;
  const withOne = l + 1;
  const pad = (56 - (withOne % 64) + 64) % 64;
  const total = withOne + pad + 8;
  const m = new Uint8Array(total);
  m.set(bytes);
  m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);
  dv.setUint32(total - 4, bitLen >>> 0, false);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  const hex = (x: number) => (x >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

// Eski kayitlar icin (yalniz dogrulama): HTTP'de uretilmis 'j' onekli cyrb53 hash'i.
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

// TUM CIHAZLARDA AYNI SHA-256 (crypto.subtle varsa onu, yoksa saf-JS ile). 64-hex, oneksiz.
async function hashPinSha256(pin: string, salt: string): Promise<string> {
  const bytes = strToBytes(`${salt}:${pin}`);
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle && typeof subtle.digest === 'function') {
    try {
      const buf = await subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      /* saf-JS'e dus (ayni cikti) */
    }
  }
  return sha256HexJs(bytes);
}

/** Girilen PIN'den saklanacak kaydi uretir (4-6 hane). Gecersizse null. */
export async function computePinRecord(pin: string): Promise<PinRecord | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;
  try {
    const salt = randHex();
    const hash = await hashPinSha256(pin, salt);
    return { salt, hash, len: pin.length };
  } catch {
    return null;
  }
}

/** Girilen PIN, verilen kayitla eslesiyor mu? Kaydin biciminden algoritmayi secer. */
export async function verifyPinAgainst(pin: string, record: PinRecord | null | undefined): Promise<boolean> {
  if (!record) return false;
  try {
    // Eski 'j' onekli kayitlar cyrb53 ile (saf-JS, her cihazda ayni) uretilmisti.
    if (record.hash.startsWith('j')) {
      return 'j' + cyrb53(`${record.salt}:${pin}`) === record.hash;
    }
    const hash = await hashPinSha256(pin, record.salt);
    return hash === record.hash;
  } catch {
    return false;
  }
}
