/*
 * Tek seferlik bakim script'i: bir taksitin (or. MacBook) odeme gununu degistirir.
 *
 * Taksitin gunu `installments[].startDate`'in gununden gelir; gelecek aylar bu
 * alandan yeniden uretildigi icin tek alan degistirmek yeterlidir. Ayrica bu ayin
 * ekranda duran (materyalize) taksit borcunun tarihi de guncellenir.
 * GECMIS (history) ve gelecek planlar DEGISTIRILMEZ.
 *
 * VARSAYILAN: KURU CALISMA (hicbir sey yazmaz, sadece ne olacagini gosterir).
 * Yazmak icin --apply eklenir; --apply once satirin yedegini bir dosyaya alir.
 *
 * Kullanim (backend konteynerinde, WORKDIR /app):
 *   Kuru calisma:  node fix-installment-day.js --match macbook --day 31
 *   Uygula:        node fix-installment-day.js --match macbook --day 31 --apply
 *   Belirli kullanici: ... --user <kullaniciAdi>
 */

const mysql = require('mysql2/promise');
try { require('dotenv').config(); } catch (_) { /* env compose'dan gelebilir */ }

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v && !v.startsWith('--')) ? v : true;
}

const MATCH = String(arg('match', 'macbook')).toLowerCase();
const DAY = Math.max(1, Math.min(31, parseInt(arg('day', '31'), 10) || 31));
const USER = arg('user', null);
const APPLY = process.argv.includes('--apply');

// startDate'in YYYY-MM'ini koru, gunu DAY yap (saat kismini dusur).
function setDay(dateStr, day) {
  const ym = String(dateStr).substring(0, 7);
  return `${ym}-${String(day).padStart(2, '0')}`;
}
// Ay sonunu asan gunleri o ayin son gunune clamp'le (Subat vb.).
function clampDay(ym, day) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Math.min(day, last);
}

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'budget_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hesabini_bil',
    dateStrings: true,
  });

  let rows;
  if (USER) {
    [rows] = await pool.query(
      'SELECT b.user_id, u.username FROM budgets b JOIN users u ON u.id=b.user_id WHERE u.username=?',
      [USER]
    );
  } else {
    [rows] = await pool.query(
      'SELECT b.user_id, u.username FROM budgets b JOIN users u ON u.id=b.user_id'
    );
  }

  if (!rows.length) { console.log('Butce kaydi bulunamadi.'); await pool.end(); return; }
  if (rows.length > 1) {
    console.log('Birden fazla kullanici var, --user ile secin:');
    rows.forEach(r => console.log('  -', r.username));
    await pool.end(); return;
  }

  const { user_id, username } = rows[0];
  const [drows] = await pool.query('SELECT data FROM budgets WHERE user_id=?', [user_id]);
  const original = drows[0].data;
  const state = JSON.parse(original);

  const insts = (state.installments || []).filter(
    i => String(i.description || '').toLowerCase().includes(MATCH)
  );

  console.log(`Kullanici: ${username}`);
  console.log(`Kesim gunu (statementCutoffDay): ${state.statementCutoffDay ?? 'kapali'}`);
  console.log(`Eslesen taksit ("${MATCH}"): ${insts.length}`);
  if (!insts.length) {
    console.log('Eslesen taksit yok. Mevcut taksitler:');
    (state.installments || []).forEach(i => console.log('  -', i.description, '| startDate:', String(i.startDate).substring(0, 10)));
    console.log('Dogru kelimeyi --match ile verin.');
    await pool.end(); return;
  }

  const matchedIds = new Set(insts.map(i => i.id));
  let ccChanges = 0;

  console.log('\n--- Planlanan degisiklikler ---');
  insts.forEach(inst => {
    const oldSd = String(inst.startDate).substring(0, 10);
    const newSd = setDay(inst.startDate, DAY);
    console.log(`Taksit: ${inst.description}`);
    console.log(`  startDate: ${oldSd}  ->  ${newSd}`);
    if (APPLY) inst.startDate = newSd;
  });

  (state.ccDebts || []).forEach(d => {
    if (d.installmentId && matchedIds.has(d.installmentId) && d.date) {
      const ym = String(d.date).substring(0, 7);
      const newDate = `${ym}-${String(clampDay(ym, DAY)).padStart(2, '0')}`;
      if (newDate !== String(d.date).substring(0, 10)) {
        console.log(`  bu ay borcu "${d.description}": ${String(d.date).substring(0, 10)} -> ${newDate}`);
        if (APPLY) d.date = newDate;
        ccChanges++;
      }
    }
  });

  if (!APPLY) {
    console.log('\n[KURU CALISMA] Hicbir sey yazilmadi. Uygulamak icin sonuna --apply ekleyin.');
    await pool.end();
    return;
  }

  const fs = require('fs');
  const backupFile = `budget-backup-${username}-${Date.now()}.json`;
  fs.writeFileSync(backupFile, original);
  await pool.query('UPDATE budgets SET data=? WHERE user_id=?', [JSON.stringify(state), user_id]);

  console.log(`\n[UYGULANDI] ${insts.length} taksit startDate + ${ccChanges} bu-ay borcu guncellendi.`);
  console.log(`Yedek dosyasi: ${backupFile}`);
  console.log('Uygulamayi kapatip tekrar giris yapin ki guncel veri yuklensin.');
  await pool.end();
})().catch(e => { console.error('Hata:', e.message); process.exit(1); });
