/*
 * SALT-OKUNUR teshis: bir taksitin (or. MacBook) durumunu ve tum aylardaki
 * KK borclarini dokumler. HICBIR SEY YAZMAZ.
 *
 * Kullanim: node inspect-installment.js --match macbook --user rgurler
 */
const mysql = require('mysql2/promise');
try { require('dotenv').config(); } catch (_) {}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v && !v.startsWith('--')) ? v : true;
}
const MATCH = String(arg('match', 'macbook')).toLowerCase();
const USER = arg('user', null);
const hit = s => String(s || '').toLowerCase().includes(MATCH);

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'budget_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hesabini_bil',
    dateStrings: true,
  });

  const where = USER ? 'WHERE u.username=?' : '';
  const [rows] = await pool.query(
    `SELECT b.user_id, u.username FROM budgets b JOIN users u ON u.id=b.user_id ${where}`,
    USER ? [USER] : []
  );
  if (!rows.length) { console.log('Kayit yok.'); await pool.end(); return; }
  if (rows.length > 1) { console.log('Cok kullanici, --user verin:', rows.map(r => r.username).join(', ')); await pool.end(); return; }

  const { user_id, username } = rows[0];
  const [drows] = await pool.query('SELECT data FROM budgets WHERE user_id=?', [user_id]);
  const s = JSON.parse(drows[0].data);

  console.log(`Kullanici: ${username}`);
  console.log(`currentMonth: ${s.currentMonth}`);
  console.log(`statementCutoffDay: ${s.statementCutoffDay ?? 'kapali'}`);

  console.log('\n=== Eslesen taksit kayitlari (installments) ===');
  (s.installments || []).filter(i => hit(i.description)).forEach(i => {
    console.log(`  ${i.description} | startDate=${String(i.startDate).substring(0,10)} | count=${i.installmentCount} | remaining=${i.remainingInstallments} | id=${i.id}`);
  });

  console.log('\n=== Bu ay (state.ccDebts) eslesen borclar ===');
  (s.ccDebts || []).filter(d => hit(d.description)).forEach(d => {
    console.log(`  ${d.description} | date=${d.date} | amount=${d.amount} | instId=${d.installmentId || '-'}`);
  });
  if (!(s.ccDebts || []).some(d => hit(d.description))) console.log('  (yok)');

  console.log('\n=== history icindeki eslesen borclar ===');
  (s.history || []).forEach(h => {
    (h.ccDebts || []).filter(d => hit(d.description)).forEach(d => {
      console.log(`  [${h.month}] ${d.description} | date=${d.date} | amount=${d.amount}`);
    });
  });

  console.log('\n=== futureData icindeki eslesen borclar ===');
  Object.entries(s.futureData || {}).forEach(([m, fd]) => {
    (fd.ccDebts || []).filter(d => hit(d.description)).forEach(d => {
      console.log(`  [${m}] ${d.description} | date=${d.date} | amount=${d.amount}`);
    });
  });

  console.log('\n(Not: gelecek aylardaki taksitler cogunlukla projeksiyondur; startDate + remaining/monthsAway ile hesaplanir, futureData\'da durmaz.)');
  await pool.end();
})().catch(e => { console.error('Hata:', e.message); process.exit(1); });
