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

// Altin turu tespiti (frontend isGoldType ile birebir ayni anahtarlar). Emanet/sahiplik
// YALNIZCA altin icin gecerli; doviz kasa kayitlari her zaman ekleyene aittir.
const isGoldType = (type: string) => {
    const lower = (type || '').toLowerCase();
    const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
    return goldKeywords.some(kw => lower.includes(kw));
};

// owner metnini sahiplige cozer. Altin + owner kayitli BASKA bir kullaniciysa -> o kullaniciya
// 'pending' emanet. owner ekleyenin kendi adiysa ya da kullanici degilse -> sahiplik yok (NULL,
// bugunku davranis: creatorUserId'ye ait). creatorUserId: sahipligin gore hesaplandigi kisi
// (ekleyen). Kullanici adlari utf8mb4_bin = harf duyarli, tam eslesme.
const resolveOwner = async (
    db: any,
    ownerText: string,
    goldType: string,
    creatorUserId: number
): Promise<{ owner_user_id: number | null; owner_status: string | null }> => {
    if (!isGoldType(goldType)) return { owner_user_id: null, owner_status: null };
    const name = (ownerText || '').trim();
    if (!name) return { owner_user_id: null, owner_status: null };
    const u = await db.get('SELECT id FROM users WHERE username = ?', [name]);
    if (!u || u.id === creatorUserId) return { owner_user_id: null, owner_status: null };
    return { owner_user_id: u.id, owner_status: 'pending' };
};

// Bir kaydi, ISTEYEN kullaniciya gore etiketler: relation (own/sent/incoming) ve counts_for_me
// (bu kaydin O kullanicinin toplamina girip girmedigi). Gercek sahip kurali:
// owner_status==='accepted' ? owner_user_id : user_id.
const annotate = (r: any, viewerUserId: number) => {
    const isCreator = r.user_id === viewerUserId;
    const ownedByOther = r.owner_user_id != null && r.owner_user_id !== r.user_id;
    let relation: 'own' | 'sent' | 'incoming';
    let counts_for_me: boolean;
    if (!ownedByOther) {
        relation = 'own';
        counts_for_me = isCreator;
    } else if (isCreator) {
        relation = 'sent';                       // ben ekledim, baskasina emanet
        counts_for_me = r.owner_status !== 'accepted';
    } else {
        relation = 'incoming';                   // bana emanet edildi
        counts_for_me = r.owner_status === 'accepted';
    }
    return { ...r, relation, counts_for_me };
};

router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        // Kendi ekledigim + bana emanet edilen (reddettiklerim haric) kayitlar.
        const records = await db.all(
            `SELECT g.*, u.username AS creator_username, ou.username AS owner_username
             FROM gold_records g
             JOIN users u ON g.user_id = u.id
             LEFT JOIN users ou ON g.owner_user_id = ou.id
             WHERE g.user_id = ? OR (g.owner_user_id = ? AND g.owner_status <> 'rejected')
             ORDER BY g.gold_type ASC`,
            [userId, userId]
        );
        const annotated = (records as any[]).map(r => annotate(r, userId));

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

        res.json({ records: annotated, vaultOrder });
    } catch (error) {
        console.error('Error fetching vault records:', error);
        res.status(500).json({ error: 'Kayıtlar getirilirken hata oluştu.' });
    }
});

// Form icin: yazilan owner bir kullanici mi, ben miyim? (/:id'den ONCE tanimli olmali)
router.get('/resolve-owner', async (req, res) => {
    try {
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        const name = String((req.query.username ?? '')).trim();
        if (!name) return res.json({ isUser: false, isSelf: false });
        const u = await db.get('SELECT id FROM users WHERE username = ?', [name]);
        res.json({ isUser: !!u, isSelf: !!u && u.id === userId });
    } catch (error) {
        console.error('Error resolving owner:', error);
        res.status(500).json({ error: 'Sahiplik çözümlenirken hata oluştu.' });
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
        const { owner_user_id, owner_status } = await resolveOwner(db, owner, gold_type, userId);
        const result = await db.run(
            'INSERT INTO gold_records (user_id, record_date, owner, gold_type, amount, note, transaction_type, owner_user_id, owner_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, record_date, owner, gold_type, amount, note || null, transaction_type || 'Giriş', owner_user_id, owner_status]
        );

        res.status(201).json({ id: result.lastID, message: 'Kayıt başarıyla eklendi.' });
    } catch (error) {
        console.error('Error adding vault record:', error);
        res.status(500).json({ error: 'Kayıt eklenirken hata oluştu.' });
    }
});

// Bana emanet edilen altini KABUL et (yalnizca sahip, pending iken) -> benim toplamima gecer.
router.post('/:id/accept', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        const result = await db.run(
            "UPDATE gold_records SET owner_status = 'accepted' WHERE id = ? AND owner_user_id = ? AND owner_status = 'pending'",
            [id, userId]
        );
        if (!result.changes) {
            return res.status(404).json({ error: 'Onaylanacak bekleyen kayıt bulunamadı.' });
        }
        res.json({ message: 'Kayıt kabul edildi.' });
    } catch (error) {
        console.error('Error accepting vault record:', error);
        res.status(500).json({ error: 'Kayıt kabul edilirken hata oluştu.' });
    }
});

// Bana emanet edilen altini REDDET (yalnizca sahip, pending iken) -> ekleyende kalir, ben gormem.
router.post('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        const result = await db.run(
            "UPDATE gold_records SET owner_status = 'rejected' WHERE id = ? AND owner_user_id = ? AND owner_status = 'pending'",
            [id, userId]
        );
        if (!result.changes) {
            return res.status(404).json({ error: 'Reddedilecek bekleyen kayıt bulunamadı.' });
        }
        res.json({ message: 'Kayıt reddedildi.' });
    } catch (error) {
        console.error('Error rejecting vault record:', error);
        res.status(500).json({ error: 'Kayıt reddedilirken hata oluştu.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { record_date, owner, gold_type, amount, note, transaction_type, secondary } = req.body;

        if (!record_date || !owner || !gold_type || amount === undefined) {
            return res.status(400).json({ error: 'Eksik veri.' });
        }

        const db = await getDb();
        const userId = (req as AuthRequest).user!.userId;
        // Duzenleme yetkisi: ekleyen VEYA sahip (2b).
        const existing = await db.get(
            'SELECT * FROM gold_records WHERE id = ? AND (user_id = ? OR owner_user_id = ?)',
            [id, userId, userId]
        );
        if (!existing) {
            return res.status(404).json({ error: 'Kayıt bulunamadı veya yetkiniz yok.' });
        }

        // Sahipligi yeni owner metnine gore (ekleyene gore) coz; ayni kullaniciya emanetse
        // mevcut durumu (accepted/pending) koru, yeni bir kullaniciya degistiyse 'pending'.
        const resolved = await resolveOwner(db, owner, gold_type, existing.user_id);
        let owner_status = resolved.owner_status;
        if (resolved.owner_user_id && resolved.owner_user_id === existing.owner_user_id && existing.owner_status) {
            owner_status = existing.owner_status;
        }

        await db.run(
            `UPDATE gold_records SET record_date = ?, owner = ?, gold_type = ?, amount = ?, note = ?, transaction_type = ?, owner_user_id = ?, owner_status = ?
             WHERE id = ? AND (user_id = ? OR owner_user_id = ?)`,
            [record_date, owner, gold_type, amount, note || null, transaction_type || 'Giriş', resolved.owner_user_id, owner_status, id, userId, userId]
        );

        if (secondary) {
            const { amount: secAmount, transaction_type: secType, note: secNote, record_date: secDate } = secondary;
            if (secAmount > 0 && secType) {
                // Ikincil kayit orijinal ekleyene (existing.user_id) ve ayni sahiplige yazilir.
                await db.run(
                    'INSERT INTO gold_records (user_id, record_date, owner, gold_type, amount, note, transaction_type, owner_user_id, owner_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [existing.user_id, secDate || record_date, owner, gold_type, secAmount, secNote || null, secType, resolved.owner_user_id, owner_status]
                );
            }
        }

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
        // Silme yetkisi: ekleyen VEYA sahip (2b).
        await db.run('DELETE FROM gold_records WHERE id = ? AND (user_id = ? OR owner_user_id = ?)', [id, userId, userId]);
        res.json({ message: 'Kayıt silindi.' });
    } catch (error) {
        console.error('Error deleting vault record:', error);
        res.status(500).json({ error: 'Kayıt silinirken hata oluştu.' });
    }
});

export default router;
