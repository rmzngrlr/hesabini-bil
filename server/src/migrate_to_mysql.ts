import { getDb as getSqliteDb } from './db.sqlite.js';
import { getMysqlDb } from './db.mysql.js';

async function migrate() {
    console.log('--- Migration Başlıyor ---');
    console.log('1. SQLite veritabanından veriler okunuyor...');

    let sqliteDb;
    try {
        sqliteDb = await getSqliteDb();
    } catch (e) {
        console.error('SQLite veritabanı açılamadı:', e);
        return;
    }

    const users = await sqliteDb.all('SELECT * FROM users');
    const budgets = await sqliteDb.all('SELECT * FROM budgets');

    console.log(`SQLite'dan ${users.length} kullanıcı ve ${budgets.length} bütçe kaydı okundu.`);

    console.log('2. MySQL veritabanına bağlanılıyor...');
    let mysqlDb;
    try {
        mysqlDb = await getMysqlDb();
    } catch (e) {
        console.error('MySQL veritabanına bağlanılamadı. Lütfen .env dosyanızdaki DB_ bilgilerinizi ve MySQL sunucunuzu kontrol edin:', e);
        return;
    }

    console.log('3. Veriler MySQL\'e kopyalanıyor...');

    let userSuccessCount = 0;
    let budgetSuccessCount = 0;

    // Migrate users
    for (const user of users) {
        try {
            // Check if user already exists in mysql to avoid unique constraint errors
            const exists = await mysqlDb.get('SELECT id FROM users WHERE id = ? OR username = ?', [user.id, user.username]);

            if (!exists) {
                // SQLite might have id as number, ensuring we preserve the same ID
                await mysqlDb.run(
                    'INSERT INTO users (id, username, password_hash, security_question, security_answer_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        user.id,
                        user.username,
                        user.password_hash,
                        user.security_question || null,
                        user.security_answer_hash || null,
                        user.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
                    ]
                );
                userSuccessCount++;
            } else {
                 console.log(`- Kullanıcı '${user.username}' zaten MySQL'de mevcut, atlanıyor.`);
            }
        } catch (e) {
            console.error(`- Kullanıcı '${user.username}' aktarılırken hata oluştu:`, e);
        }
    }

    // Migrate budgets
    for (const budget of budgets) {
        try {
             const exists = await mysqlDb.get('SELECT user_id FROM budgets WHERE user_id = ?', [budget.user_id]);

             if (!exists) {
                 await mysqlDb.run(
                     'INSERT INTO budgets (user_id, data, updated_at) VALUES (?, ?, ?)',
                     [
                         budget.user_id,
                         budget.data,
                         budget.updated_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
                     ]
                 );
                 budgetSuccessCount++;
             } else {
                 console.log(`- Kullanıcı ID ${budget.user_id} için bütçe zaten MySQL'de mevcut, atlanıyor.`);
             }
        } catch (e) {
             console.error(`- Kullanıcı ID ${budget.user_id} bütçesi aktarılırken hata oluştu:`, e);
        }
    }

    console.log('--- Migration Tamamlandı ---');
    console.log(`Aktarılan Kullanıcı: ${userSuccessCount}/${users.length}`);
    console.log(`Aktarılan Bütçe: ${budgetSuccessCount}/${budgets.length}`);
    console.log('Artık MySQL veritabanını kullanabilirsiniz.');
    process.exit(0);
}

migrate().catch(e => {
    console.error('Migration sırasında beklenmeyen hata:', e);
    process.exit(1);
});
