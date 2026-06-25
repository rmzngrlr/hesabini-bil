import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/authMiddleware';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, password, securityQuestion, securityAnswer } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    try {
        const db = await getDb();

        // Check if user exists
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        let question = null;
        let answerHash = null;

        if (securityQuestion && securityAnswer) {
            question = securityQuestion;
            answerHash = await bcrypt.hash(securityAnswer.toLowerCase().trim(), salt);
        }

        // Insert user
        const result = await db.run(
            'INSERT INTO users (username, password_hash, security_question, security_answer_hash) VALUES (?, ?, ?, ?)',
            [username, passwordHash, question, answerHash]
        );

        // Generate Token with isAdmin defaulted to true for all users
        const isAdmin = true;
        const token = jwt.sign({ userId: result.lastID, username, isAdmin }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ message: 'Kayıt başarılı', token, username, isAdmin });
    } catch (error) {
        console.error('Kayıt hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    try {
        const db = await getDb();

        // Find user
        const user = await db.get('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
        }

        // Everyone is an admin now (has vault access)
        const isAdmin = true;

        // Generate Token
        const token = jwt.sign({ userId: user.id, username: user.username, isAdmin }, JWT_SECRET, { expiresIn: '30d' });

        res.json({ message: 'Giriş başarılı', token, username: user.username, isAdmin });
    } catch (error) {
        console.error('Giriş hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// GET /api/auth/security-question/:username
router.get('/security-question/:username', async (req, res) => {
    const { username } = req.params;

    try {
        const db = await getDb();
        const user = await db.get('SELECT security_question FROM users WHERE username = ?', [username]);

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (!user.security_question) {
            return res.status(400).json({ error: 'Bu kullanıcı için güvenlik sorusu ayarlanmamış.' });
        }

        res.json({ question: user.security_question });
    } catch (error) {
        console.error('Güvenlik sorusu getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { username, securityAnswer, newPassword } = req.body;

    if (!username || !securityAnswer || !newPassword) {
        return res.status(400).json({ error: 'Tüm alanlar gereklidir.' });
    }

    try {
        const db = await getDb();
        const user = await db.get('SELECT id, security_answer_hash FROM users WHERE username = ?', [username]);

        if (!user || !user.security_answer_hash) {
            return res.status(400).json({ error: 'Geçersiz kullanıcı veya güvenlik sorusu ayarlanmamış.' });
        }

        // Verify answer
        const isMatch = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.security_answer_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Güvenlik sorusu cevabı yanlış.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);

        res.json({ message: 'Şifreniz başarıyla sıfırlandı.' });
    } catch (error) {
        console.error('Şifre sıfırlama hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/auth/set-security-question (Requires Auth)
router.post('/set-security-question', authenticate, async (req: any, res: any) => {
    const { securityQuestion, securityAnswer } = req.body;
    const userId = req.user.userId;

    if (!securityQuestion || !securityAnswer) {
        return res.status(400).json({ error: 'Güvenlik sorusu ve cevabı gereklidir.' });
    }

    try {
        const db = await getDb();
        const salt = await bcrypt.genSalt(10);
        const answerHash = await bcrypt.hash(securityAnswer.toLowerCase().trim(), salt);

        await db.run(
            'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
            [securityQuestion, answerHash, userId]
        );

        res.json({ message: 'Güvenlik sorusu başarıyla güncellendi.' });
    } catch (error) {
        console.error('Güvenlik sorusu ayarlama hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

// POST /api/auth/change-password (Requires Auth)
router.post('/change-password', authenticate, async (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir.' });
    }

    try {
        const db = await getDb();

        // Find user
        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Mevcut şifreniz yanlış.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

        res.json({ message: 'Şifreniz başarıyla değiştirildi.' });
    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası oluştu.' });
    }
});

export default router;
