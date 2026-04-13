import dotenv from 'dotenv';
import { getDb as getSqliteDb } from './db.sqlite';
import { getMysqlDb } from './db.mysql';

dotenv.config();

// Determine which database implementation to return based on .env
export const getDb = async () => {
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'mysql') {
        return await getMysqlDb();
    } else {
        return await getSqliteDb();
    }
};
