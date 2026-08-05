/*
 * Butce verisini bir yedek dosyasindan (budget-backup-*.json) geri yukler.
 * fix-installment-day.js --apply calisirken bu yedegi olusturur.
 *
 * VARSAYILAN: KURU CALISMA (yazmaz). Uygulamak icin --apply.
 * Yazmadan once mevcut durumu ayrica pre-restore-*.json olarak yedekler.
 *
 * Kullanim (backend konteynerinde, WORKDIR /app):
 *   Kuru calisma:  node restore-budget.js --user rgurler
 *   Uygula:        node restore-budget.js --user rgurler --apply
 *   Belirli dosya: ... --file budget-backup-rgurler-1234567890.json
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
try { require('dotenv').config(); } catch (_) {}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v && !v.startsWith('--')) ? v : true;
}
const USER = arg('user', null);
let FILE = arg('file', null);
const APPLY = process.argv.includes('--apply');

(async () => {
  if (!FILE || FILE === true) {
    const files = fs.readdirSync('.').filter(f => /^budget-backup-.*\.json$/.test(f)).sort();
    if (!files.length) { console.log('Yedek (budget-backup-*.json) bulunamadi. --file ile yol verin.'); return; }
    if (files.length > 1) { console.log('Birden fazla yedek var, --file ile secin:'); files.forEach(f => console.log('  -', f)); return; }
    FILE = files[0];
    console.log('Yedek dosyasi:', FILE);
  }

  const raw = fs.readFileSync(FILE, 'utf8');
  const state = JSON.parse(raw); // gecerli mi kontrol + ozet
  console.log(`Yedek icerigi -> currentMonth: ${state.currentMonth} | statementCutoffDay: ${state.statementCutoffDay ?? 'kapali'}`);
  (state.installments || []).filter(i => String(i.description || '').toLowerCase().includes('macbook'))
    .forEach(i => console.log(`  taksit: ${i.description} | startDate=${String(i.startDate).substring(0, 10)}`));

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
  if (!rows.length) { console.log('Kullanici/butce bulunamadi.'); await pool.end(); return; }
  if (rows.length > 1) { console.log('Cok kullanici, --user verin:', rows.map(r => r.username).join(', ')); await pool.end(); return; }
  const { user_id, username } = rows[0];

  if (!APPLY) {
    console.log(`\n[KURU CALISMA] '${username}' icin geri yukleme YAPILMADI. Uygulamak icin --apply ekleyin.`);
    await pool.end();
    return;
  }

  const [cur] = await pool.query('SELECT data FROM budgets WHERE user_id=?', [user_id]);
  const safety = `pre-restore-${username}-${Date.now()}.json`;
  fs.writeFileSync(safety, cur[0].data);

  // Birebir orijinal string'i geri yaz.
  await pool.query('UPDATE budgets SET data=? WHERE user_id=?', [raw, user_id]);

  console.log(`\n[YUKLENDI] '${username}' butcesi '${FILE}' yedeginden geri yuklendi.`);
  console.log(`Mevcut (geri alinabilir) durum: ${safety}`);
  console.log('Uygulamayi kapatip tekrar giris yapin ki guncel veri yuklensin.');
  await pool.end();
})().catch(e => { console.error('Hata:', e.message); process.exit(1); });
