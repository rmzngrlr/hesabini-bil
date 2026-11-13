import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import budgetRoutes from './routes/budget';
import vaultRoutes from './routes/vault';
import pushRoutes from './routes/push';
import { getDb } from './db';
import { ensureVapid, sendToUser } from './push';

dotenv.config();

const app = express();
const PORT = 3005; // Sabit port kullanımı, global PORT değişkeninin çakışmasını önler

// Middleware
app.use(cors());
// Increase JSON payload limit since budget state might grow large with history
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/push', pushRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Hatırlatıcı zamanlayıcısı: periyodik olarak vadesi gelmiş (fire_at <= şimdi) ve
 * henüz gönderilmemiş (sent_at IS NULL) hatırlatıcıları push ile gönderir.
 * Uygulama kapalı olsa bile çalışır (sunucu sürekli ayakta). Tek süreç içi setInterval
 * yeterli: konteyner "restart: unless-stopped" ile sürekli çalışır.
 */
const startReminderScheduler = () => {
    const TICK_MS = 5 * 60 * 1000; // 5 dakika
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    const run = async () => {
        try {
            const db = await getDb();
            const now = Date.now();
            const due = await db.all(
                'SELECT id, user_id, title, body, url FROM push_reminders WHERE sent_at IS NULL AND fire_at <= ?',
                [now]
            );
            for (const r of due as any[]) {
                await sendToUser(r.user_id, {
                    title: r.title,
                    body: r.body,
                    url: r.url || '/',
                    tag: 'hb-reminder-' + r.id,
                });
                await db.run('UPDATE push_reminders SET sent_at = ? WHERE id = ?', [now, r.id]);
            }
            // Eski (gönderilmiş) hatırlatıcıları temizle.
            await db.run('DELETE FROM push_reminders WHERE sent_at IS NOT NULL AND sent_at < ?', [now - THIRTY_DAYS]);
        } catch (e) {
            console.error('Hatırlatıcı zamanlayıcı hatası:', e);
        }
    };

    setInterval(run, TICK_MS);
    // İlk tetik: başlangıçtan kısa süre sonra (DB bağlantısı yerleşsin).
    setTimeout(run, 30 * 1000);
};

// Initialize DB and start server
const startServer = async () => {
    try {
        await getDb();
        console.log('Veritabanı bağlantısı başarılı.');

        // VAPID anahtarlarını hazırla (yoksa üret + kaydet). Hata olsa bile sunucu ayağa kalksın.
        try {
            await ensureVapid();
            console.log('Web Push (VAPID) hazır.');
        } catch (e) {
            console.error('VAPID hazırlanamadı (push devre dışı olabilir):', e);
        }

        app.listen(PORT as number, '0.0.0.0', () => {
            console.log(`Sunucu http://0.0.0.0:${PORT} portunda çalışıyor.`);
        });

        startReminderScheduler();
    } catch (error) {
        console.error('Sunucu başlatılamadı:', error);
        process.exit(1);
    }
};

startServer();
