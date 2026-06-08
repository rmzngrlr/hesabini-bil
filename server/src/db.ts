import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let adapterInstance: any = null;

export const getDb = async () => {
    if (adapterInstance) {
        return adapterInstance;
    }

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'budget_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hesabini_bil',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Initialize schema
    const connection = await pool.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                security_question VARCHAR(255),
                security_answer_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS budgets (
                user_id INT PRIMARY KEY,
                data LONGTEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if is_admin column exists
        const [columns] = await connection.query<mysql.RowDataPacket[]>(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin' AND TABLE_SCHEMA = DATABASE()
        `);

        if (columns.length === 0) {
            await connection.query(`
                ALTER TABLE users
                ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
            `);

            // Yetkilendirme (rgurler)
            await connection.query(`
                UPDATE users
                SET is_admin = TRUE
                WHERE username = 'rgurler';
            `);
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS gold_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                record_date DATE NOT NULL,
                owner VARCHAR(255) NOT NULL,
                gold_type VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 4) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Check if note column exists in gold_records
        const [grColumns] = await connection.query<mysql.RowDataPacket[]>(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'gold_records' AND COLUMN_NAME IN ('note', 'transaction_type') AND TABLE_SCHEMA = DATABASE()
        `);

        const columnNames = grColumns.map((col: any) => col.COLUMN_NAME);

        if (!columnNames.includes('note')) {
            await connection.query(`
                ALTER TABLE gold_records
                ADD COLUMN note VARCHAR(1000) DEFAULT NULL;
            `);
        }

        if (!columnNames.includes('transaction_type')) {
            await connection.query(`
                ALTER TABLE gold_records
                ADD COLUMN transaction_type VARCHAR(50) DEFAULT 'Giriş';
            `);
        }

    } finally {
        connection.release();
    }

    // Return an adapter object that mimics the sqlite API
    // so we don't have to rewrite all our route controllers immediately.
    adapterInstance = {
        get: async (sql: string, params: any[] = []) => {
            const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params);
            return rows.length > 0 ? rows[0] : undefined;
        },
        all: async (sql: string, params: any[] = []) => {
            const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params);
            return rows;
        },
        run: async (sql: string, params: any[] = []) => {
            const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params);
            return {
                lastID: result.insertId,
                changes: result.affectedRows
            };
        },
        // We will need the raw pool for migration scripts
        _pool: pool
    };
    return adapterInstance;
};
