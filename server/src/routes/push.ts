import express from 'express';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { ensureVapid, sendToUser } from '../push';

const router = express.Router();

/** VAPID public key (gizli DEĞİL). İstemci abone olurken applicationServerKey için kullanır. */
router.get('/public-key', async (_req, res) => {
  try {
    const publicKey = await ensureVapid();
    res.json({ publicKey });
  } catch (e) {
    console.error('VAPID public-key hatası:', e);
    res.status(500).json({ error: 'VAPID anahtarı alınamadı.' });
  }
});

/** Abonelik kaydet. İlk kez (bu endpoint yeni) abone olunuyorsa deneme bildirimi gönder. */
router.post('/subscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const sub = req.body?.subscription;
    const userAgent = String(req.body?.userAgent || '').slice(0, 255);

    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(400).json({ error: 'Geçersiz abonelik.' });
    }

    const db = await getDb();
    const existing = await db.get('SELECT id FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
    await db.run(
      'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)',
      [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent]
    );

    let testSent = 0;
    if (!existing) {
      testSent = await sendToUser(userId, {
        title: 'Bildirimler açık ✅',
        body: 'Hesabını Bil bildirimleri etkinleştirildi. Fatura ve kredi kartı hatırlatmaları artık telefonuna gelecek.',
        url: '/',
        tag: 'hb-test',
      });
    }

    res.json({ ok: true, firstTime: !existing, testSent });
  } catch (error) {
    console.error('Abonelik kaydı hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

/** Abonelik sil (kullanıcı bildirimleri kapatınca). */
router.post('/unsubscribe', authenticate, async (req: AuthRequest, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'endpoint gerekli.' });
    const db = await getDb();
    await db.run('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user!.userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Abonelik silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

/** Elle test bildirimi (Ayarlar'daki "Test bildirimi gönder" butonu). */
router.post('/test', authenticate, async (req: AuthRequest, res) => {
  try {
    const sent = await sendToUser(req.user!.userId, {
      title: 'Deneme bildirimi 🔔',
      body: 'Bu bir test bildirimidir. Bildirimler çalışıyor!',
      url: '/',
      tag: 'hb-test',
    });
    res.json({ ok: true, sent });
  } catch (error) {
    console.error('Test bildirimi hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

/**
 * Hatırlatıcıları eşitle. İstemci (tüm vade mantığının bulunduğu yer) yaklaşan
 * hatırlatıcıları hesaplayıp buraya gönderir; sunucu bunları saklar ve zamanlayıcı
 * vadesi gelenleri uygulama kapalı olsa bile gönderir.
 * Gönderilen liste TAM listedir: listede olmayan eski kayıtlar (ödenmiş vb.) silinir.
 * body: { reminders: [{ key, title, body, url, fireAt(epoch ms) }] }
 */
router.post('/sync-reminders', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const items = Array.isArray(req.body?.reminders) ? req.body.reminders : [];
    const db = await getDb();

    const keys: string[] = [];
    for (const it of items) {
      if (!it || typeof it.key !== 'string' || typeof it.fireAt !== 'number' || !isFinite(it.fireAt)) continue;
      const key = it.key.slice(0, 191);
      const title = String(it.title || 'Hatırlatma').slice(0, 255);
      const body = String(it.body || '').slice(0, 500);
      const url = String(it.url || '/').slice(0, 255);
      const fireAt = Math.floor(it.fireAt);
      keys.push(key);

      const existing = await db.get(
        'SELECT id, fire_at FROM push_reminders WHERE user_id = ? AND reminder_key = ?',
        [userId, key]
      );
      if (existing) {
        // fireAt değiştiyse (ör. vade tarihi güncellendi) sent_at sıfırla -> yeni tarih için tekrar bildir.
        const resetSent = Number(existing.fire_at) !== fireAt;
        await db.run(
          'UPDATE push_reminders SET title = ?, body = ?, url = ?, fire_at = ?' +
            (resetSent ? ', sent_at = NULL' : '') +
            ' WHERE id = ?',
          [title, body, url, fireAt, existing.id]
        );
      } else {
        await db.run(
          'INSERT INTO push_reminders (user_id, reminder_key, title, body, url, fire_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, key, title, body, url, fireAt]
        );
      }
    }

    // Listede olmayanları (artık geçersiz / ödenmiş) sil.
    const all = await db.all('SELECT id, reminder_key FROM push_reminders WHERE user_id = ?', [userId]);
    for (const r of all as any[]) {
      if (!keys.includes(r.reminder_key)) {
        await db.run('DELETE FROM push_reminders WHERE id = ?', [r.id]);
      }
    }

    res.json({ ok: true, count: keys.length });
  } catch (error) {
    console.error('Hatırlatıcı eşitleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

export default router;
