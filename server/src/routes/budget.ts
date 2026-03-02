import express from 'express';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/budget
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const db = await getDb();

        const row = await db.get('SELECT data FROM budgets WHERE user_id = ?', [userId]);

        if (row) {
            res.json(JSON.parse(row.data));
        } else {
            // Return 404 or an empty object. Usually 404 implies "not found, create one".
            // Let's return 404 to let frontend know it needs to initialize.
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
            ON CONFLICT(user_id) DO UPDATE SET
                data=excluded.data,
                updated_at=CURRENT_TIMESTAMP
        `, [userId, dataString]);

        res.json({ message: 'Bütçe başarıyla kaydedildi.' });
    } catch (error) {
        console.error('Bütçe kaydetme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

export default router;
