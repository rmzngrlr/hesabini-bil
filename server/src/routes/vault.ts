import express from 'express';
import { getDb } from '../db';
import { authenticate, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticate);

// Protect vault routes to ensure only admin has access
router.use((req, res, next) => {
    if (!(req as AuthRequest).user?.isAdmin) {
        return res.status(403).json({ error: 'Bu sayfaya erişim yetkiniz yok.' });
    }
    next();
});

router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        const records = await db.all('SELECT * FROM gold_records WHERE user_id = ? ORDER BY gold_type ASC', [userId]);

        // Also fetch the vault order preference
        const userRow = await db.get('SELECT vault_order FROM users WHERE id = ?', [userId]);
        let vaultOrder = [];
        if (userRow && userRow.vault_order) {
            try {
                vaultOrder = JSON.parse(userRow.vault_order);
            } catch (e) {
                console.error("Error parsing vault_order JSON", e);
            }
        }

        res.json({ records, vaultOrder });
    } catch (error) {
        console.error('Error fetching vault records:', error);
        res.status(500).json({ error: 'Kayıtlar getirilirken hata oluştu.' });
    }
});

router.put('/order', async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Geçersiz sıralama verisi.' });
        }

        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        await db.run('UPDATE users SET vault_order = ? WHERE id = ?', [JSON.stringify(order), userId]);

        res.json({ message: 'Sıralama güncellendi.' });
    } catch (error) {
        console.error('Error updating vault order:', error);
        res.status(500).json({ error: 'Sıralama güncellenirken hata oluştu.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { record_date, owner, gold_type, amount, note, transaction_type } = req.body;
        if (!record_date || !owner || !gold_type || amount === undefined) {
            return res.status(400).json({ error: 'Eksik veri.' });
        }

        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        const result = await db.run(
            'INSERT INTO gold_records (user_id, record_date, owner, gold_type, amount, note, transaction_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, record_date, owner, gold_type, amount, note || null, transaction_type || 'Giriş']
        );

        res.status(201).json({ id: result.lastID, message: 'Kayıt başarıyla eklendi.' });
    } catch (error) {
        console.error('Error adding vault record:', error);
        res.status(500).json({ error: 'Kayıt eklenirken hata oluştu.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { record_date, owner, gold_type, amount, note, transaction_type } = req.body;

        if (!record_date || !owner || !gold_type || amount === undefined) {
            return res.status(400).json({ error: 'Eksik veri.' });
        }

        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        await db.run(
            'UPDATE gold_records SET record_date = ?, owner = ?, gold_type = ?, amount = ?, note = ?, transaction_type = ? WHERE id = ? AND user_id = ?',
            [record_date, owner, gold_type, amount, note || null, transaction_type || 'Giriş', id, userId]
        );

        res.json({ message: 'Kayıt güncellendi.' });
    } catch (error) {
        console.error('Error updating vault record:', error);
        res.status(500).json({ error: 'Kayıt güncellenirken hata oluştu.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        await db.run('DELETE FROM gold_records WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Kayıt silindi.' });
    } catch (error) {
        console.error('Error deleting vault record:', error);
        res.status(500).json({ error: 'Kayıt silinirken hata oluştu.' });
    }
});

export default router;
