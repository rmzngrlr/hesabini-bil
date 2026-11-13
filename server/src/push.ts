import webpush from 'web-push';
import { getDb } from './db';

// VAPID "subject": push servisinin iletişim kurabileceği bir mailto/URL (gizli DEĞİL).
// Kullanıcının kişisel e-postası DEĞİL; uygulama/alan adı tabanlı genel bir adres.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@rgmedya.tr';

let cachedPublicKey: string | null = null;
let configured = false;

/**
 * VAPID anahtarlarını hazırla. Öncelik: .env (opsiyonel) -> DB (push_config) -> yoksa ÜRET + sakla.
 * Böylece kurulum sıfır-konfig: ilk açılışta anahtar üretilip DB'ye yazılır.
 * public_key gizli değildir (istemciye verilir); private_key yalnız sunucuda kalır.
 */
export const ensureVapid = async (): Promise<string> => {
  if (configured && cachedPublicKey) return cachedPublicKey;
  const db = await getDb();

  let publicKey: string;
  let privateKey: string;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    publicKey = process.env.VAPID_PUBLIC_KEY;
    privateKey = process.env.VAPID_PRIVATE_KEY;
  } else {
    const row = await db.get('SELECT public_key, private_key FROM push_config WHERE id = 1');
    if (row && row.public_key && row.private_key) {
      publicKey = row.public_key;
      privateKey = row.private_key;
    } else {
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      await db.run(
        'INSERT INTO push_config (id, public_key, private_key, subject) VALUES (1, ?, ?, ?) ' +
          'ON DUPLICATE KEY UPDATE public_key = VALUES(public_key), private_key = VALUES(private_key), subject = VALUES(subject)',
        [publicKey, privateKey, VAPID_SUBJECT]
      );
      console.log('VAPID anahtarları üretildi ve push_config tablosuna kaydedildi.');
    }
  }

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  cachedPublicKey = publicKey;
  configured = true;
  return publicKey;
};

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Bir kullanıcının TÜM aboneliklerine (cihazlarına) bildirim gönderir.
 * 404/410 dönen (süresi dolmuş / iptal edilmiş) abonelikler otomatik silinir.
 * Dönüş: başarıyla gönderilen abonelik sayısı.
 */
export const sendToUser = async (userId: number, payload: PushPayload): Promise<number> => {
  await ensureVapid();
  const db = await getDb();
  const subs = await db.all('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  const data = JSON.stringify(payload);
  let sent = 0;

  for (const s of subs as any[]) {
    const subscription = {
      endpoint: s.endpoint as string,
      keys: { p256dh: s.p256dh as string, auth: s.auth as string },
    };
    try {
      await webpush.sendNotification(subscription, data);
      sent++;
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Abonelik ölmüş -> temizle.
        await db.run('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
      } else {
        console.error('Push gönderim hatası:', status, err?.body || err?.message || err);
      }
    }
  }
  return sent;
};
