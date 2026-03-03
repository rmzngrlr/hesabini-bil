import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import budgetRoutes from './routes/budget';
import { getDb } from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
// Increase JSON payload limit since budget state might grow large with history
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/budget', budgetRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize DB and start server
const startServer = async () => {
    try {
        await getDb();
        console.log('Veritabanı bağlantısı başarılı.');

        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
        });
    } catch (error) {
        console.error('Sunucu başlatılamadı:', error);
        process.exit(1);
    }
};

startServer();
