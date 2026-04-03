import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export const getDb = async (): Promise<Database> => {
    if (dbInstance) {
        return dbInstance;
    }

    const dbPath = path.resolve(__dirname, '../../database.sqlite');

    dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Initialize schema
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            security_question TEXT,
            security_answer_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS budgets (
            user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    `);

    // Migration for existing databases
    try {
        const tableInfo = await dbInstance.all("PRAGMA table_info(users)");
        const hasSecurityQuestion = tableInfo.some(col => col.name === 'security_question');
        if (!hasSecurityQuestion) {
            await dbInstance.exec(`
                ALTER TABLE users ADD COLUMN security_question TEXT;
                ALTER TABLE users ADD COLUMN security_answer_hash TEXT;
            `);
        }
    } catch (err) {
        console.error("Migration error: ", err);
    }

    return dbInstance;
};
