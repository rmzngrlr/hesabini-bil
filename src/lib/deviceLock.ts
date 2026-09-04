/**
 * WebAuthn tabanli, ISTEMCI-ONLY "cihaz kilidi". Sunucu gerekmez:
 * - Kurulum: platform authenticator'a (telefonun parmak izi/yuz/PIN'i) bir kimlik
 *   kaydedilir; kimligin ID'si bu cihazin localStorage'ina yazilir (hesaba senkron
 *   EDILMEZ — kimlik cihaza baglidir).
 * - Acilis: kayitli kimlik dogrulanir (userVerification: 'required') -> telefonun
 *   biyometri/kilit ekrani tetiklenir; gecerse uygulama acilir.
 *
 * NOT: Bu bir KOLAYLIK kapisidir; localStorage'a erisebilen ileri bir kullanici
 * teknik olarak atlayabilir. WebAuthn yalniz secure context'te (HTTPS ya da
 * localhost) calisir — telefonda Tailscale HTTPS (*.ts.net) adresi gerekir.
 */

const CRED_KEY = 'device_lock_credential_id';
const ENABLED_KEY = 'device_lock_enabled';

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function randomBytes(len = 32): Uint8Array {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return a;
}

/** WebAuthn + secure context bu cihazda mevcut mu? */
export function isDeviceLockSupported(): boolean {
  return typeof window !== 'undefined'
    && !!window.isSecureContext
    && typeof window.PublicKeyCredential !== 'undefined'
    && !!(navigator.credentials && navigator.credentials.create && navigator.credentials.get);
}

/** Bu cihazda kilit kurulu ve acik mi? */
export function isDeviceLockEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true' && !!localStorage.getItem(CRED_KEY);
  } catch {
    return false;
  }
}

/** Kilidi kur (biyometri kaydi). Basarili olursa true. */
export async function registerDeviceLock(username?: string | null): Promise<boolean> {
  if (!isDeviceLockSupported()) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(),
        // rp.id verilmez -> mevcut host'a ( or. *.ts.net) baglanir.
        rp: { name: 'Hesabını Bil' },
        user: {
          id: randomBytes(16), // rastgele kullanici tanitici (istemci-only, sunucu yok)
          name: username || 'kullanici',
          displayName: username || 'Kullanıcı',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, bufToB64url(cred.rawId));
    localStorage.setItem(ENABLED_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

/** Kilidi ac (biyometri dogrulama). Gecerse true. */
export async function verifyDeviceLock(): Promise<boolean> {
  if (!isDeviceLockSupported()) return false;
  let credId: string | null = null;
  try { credId = localStorage.getItem(CRED_KEY); } catch { credId = null; }
  if (!credId) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(),
        allowCredentials: [{ type: 'public-key', id: b64urlToBuf(credId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

/** Kilidi kaldir. */
export function disableDeviceLock(): void {
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* yoksay */
  }
}
