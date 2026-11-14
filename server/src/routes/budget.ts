import express from 'express';
import crypto from 'crypto';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';
import { addClient, removeClient, broadcast } from '../sse';

const router = express.Router();

// --- Canlı senkron: tek-kullanımlık SSE bileti ---------------------------
// EventSource özel başlık (Authorization) gönderemez; bu yüzden istemci önce
// Bearer ile kısa ömürlü bir bilet alır, sonra bileti URL'de kullanarak akışa
// bağlanır. Böylece uzun ömürlü JWT nginx/Cloudflare loglarına URL'de düşmez.
type StreamTicket = { userId: number; exp: number };
const streamTickets = new Map<string, StreamTicket>();
const TICKET_TTL_MS = 30 * 1000;

// GET /api/budget
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const db = await getDb();

        const row = await db.get('SELECT data FROM budgets WHERE user_id = ?', [userId]);

        if (row) {
            res.json(JSON.parse(row.data));
        } else {
            res.status(404).json({ message: 'Bütçe verisi bulunamadı.' });
        }
    } catch (error) {
        console.error('Bütçe getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/budget
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const budgetData = req.body;

        if (!budgetData) {
            return res.status(400).json({ error: 'Bütçe verisi eksik.' });
        }

        const db = await getDb();
        const dataString = JSON.stringify(budgetData);

        // Upsert logic (Insert or Update)
        await db.run(`
            INSERT INTO budgets (user_id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                data=VALUES(data),
                updated_at=CURRENT_TIMESTAMP
        `, [userId, dataString]);

        res.json({ message: 'Bütçe başarıyla kaydedildi.' });

        // Kullanıcının DİĞER cihazlarına "bütçe değişti" sinyali gönder (echo için
        // kaydeden sekme hariç). Onlar bir kez GET /budget çekip güncellenir.
        const tabId = req.header('X-Tab-Id') || undefined;
        broadcast(userId, { scope: 'budget' }, tabId);
    } catch (error) {
        console.error('Bütçe kaydetme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/budget/stream-ticket — akışa bağlanmak için tek-kullanımlık bilet üretir.
router.post('/stream-ticket', authenticate, async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    // Fırsatçı temizlik: süresi geçmiş biletleri at.
    const now = Date.now();
    for (const [k, v] of streamTickets) {
        if (v.exp < now) streamTickets.delete(k);
    }
    const ticket = crypto.randomBytes(24).toString('hex');
    streamTickets.set(ticket, { userId, exp: now + TICKET_TTL_MS });
    res.json({ ticket });
});

// GET /api/budget/stream?ticket=...&tab=... — SSE akışı (bilet ile doğrulanır).
router.get('/stream', async (req, res) => {
    const ticket = String(req.query.ticket || '');
    const tabId = String(req.query.tab || '');
    const t = streamTickets.get(ticket);
    streamTickets.delete(ticket); // tek kullanımlık
    if (!t || t.exp < Date.now()) {
        res.status(401).end();
        return;
    }
    const userId = t.userId;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx buffering'i kapat (SSE akışı bufferlanmasın)
    });
    res.write(': connected\n\n');
    if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

    const client = addClient(userId, res, tabId);
    req.on('close', () => removeClient(userId, client));
});

export default router;
