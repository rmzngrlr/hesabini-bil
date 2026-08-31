import type {
  BudgetState,
  DailyExpense,
  CCDebt,
  Installment,
  FixedExpense,
  CustomIncome,
  GoldRecord,
} from '../types';

/**
 * Global arama modulu (SALT-OKUNUR).
 *
 * Indeks DAIMA ham realState (+ history + futureData) ve backend vaultRecords'tan kurulur;
 * derivedState/projeksiyon (proj-*) ASLA kaynak alinmaz (turetilmis satirlar tiklaninca
 * gercek kayit bulunamaz). Ayni sebeple turetilmis id-onekleri ve otomatik basliklar elenir.
 * Hicbir fonksiyon setState cagirmaz; tamami saf.
 */

// --- Kanonik varlik yardimcilari (mevcut kopyalarla ayni mantik; ileride tek kaynak olabilir) ---

export function isGoldType(type: string): boolean {
  const lower = String(type ?? '').toLowerCase();
  const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
  return goldKeywords.some(kw => lower.includes(kw));
}

export function getAssetFullTitle(name: string): string {
  const raw = String(name ?? '');
  const lower = raw.trim().toLowerCase();

  if (isGoldType(raw)) {
    if (lower.includes('altın') || lower.includes('lira')) return raw;
    if (lower === 'gram') return 'Gram Altın';
    if (lower === 'çeyrek') return 'Çeyrek Altın';
    if (lower === 'yarım') return 'Yarım Altın';
    if (lower === 'tam') return 'Tam Altın';
    if (lower === 'ata') return 'Ata Altın';
    if (lower === 'reşat') return 'Reşat Altın';
    if (lower === 'bilezik') return 'Bilezik Altın';
    if (lower === 'külçe') return 'Külçe Altın';
    return `${raw} Altın`;
  }

  const mapping: Record<string, string> = {
    'nakit': 'TL', 'tl': 'TL',
    'yk': 'Yemek Kartı', 'yemek kartı': 'Yemek Kartı',
    'bam': 'Bosna-Hersek Markı', 'bosna-hersek markı': 'Bosna-Hersek Markı',
    'usd': 'Amerikan Doları', 'dolar': 'Amerikan Doları', 'amerikan doları': 'Amerikan Doları',
    'eur': 'Euro', 'euro': 'Euro',
    'gbp': 'İngiliz Sterlini', 'sterlin': 'İngiliz Sterlini', 'ingiliz sterlini': 'İngiliz Sterlini',
    'chf': 'İsviçre Frangı', 'frang': 'İsviçre Frangı', 'isviçre frangı': 'İsviçre Frangı',
    'cad': 'Kanada Doları', 'kanada doları': 'Kanada Doları',
    'aud': 'Avustralya Doları', 'avustralya doları': 'Avustralya Doları',
    'rub': 'Rus Rublesi', 'ruble': 'Rus Rublesi', 'rus rublesi': 'Rus Rublesi',
    'jpy': 'Japon Yeni', 'yen': 'Japon Yeni', 'japon yeni': 'Japon Yeni',
    'sar': 'Suudi Arabistan Riyali', 'riyali': 'Suudi Arabistan Riyali', 'suudi arabistan riyali': 'Suudi Arabistan Riyali',
    'aed': 'Birleşik Arap Emirlikleri Dirhemi', 'dirhem': 'Birleşik Arap Emirlikleri Dirhemi', 'birleşik arap emirlikleri dirhemi': 'Birleşik Arap Emirlikleri Dirhemi',
    'kwd': 'Kuveyt Dinarı', 'dinar': 'Kuveyt Dinarı', 'kuveyt dinarı': 'Kuveyt Dinarı',
    'syp': 'Suriye Lirası', 'suriye lirası': 'Suriye Lirası',
    'lbp': 'Lübnan Lirası', 'lübnan lirası': 'Lübnan Lirası',
    'uzs': 'Özbekistan Somu', 'özbekistan somu': 'Özbekistan Somu',
    'irr': 'İran Riyali', 'iran riyali': 'İran Riyali',
    'cny': 'Çin Yuanı', 'çin yuanı': 'Çin Yuanı',
    'sek': 'İsveç Kronu', 'isveç kronu': 'İsveç Kronu',
    'nok': 'Norveç Kronu', 'norveç kronu': 'Norveç Kronu',
    'dkk': 'Danimarka Kronu', 'danimarka kronu': 'Danimarka Kronu',
    'azn': 'Azerbaycan Manatı', 'azerbaycan manatı': 'Azerbaycan Manatı',
    'qar': 'Katar Riyali', 'katar riyali': 'Katar Riyali',
    'iqd': 'Irak Dinarı', 'irak dinarı': 'Irak Dinarı',
    'uah': 'Ukrayna Grivnası', 'ukrayna grivnası': 'Ukrayna Grivnası',
    'inr': 'Hindistan Rupisi', 'hindistan rupisi': 'Hindistan Rupisi',
    'egp': 'Mısır Lirası', 'mısır lirası': 'Mısır Lirası',
    'krw': 'Güney Kore Wonu', 'güney kore wonu': 'Güney Kore Wonu',
  };

  const fallback = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return mapping[lower] || fallback;
}

/**
 * Turkce-duyarli KUCUK HARF (aksan KORUNUR). 'İ'->'i', 'I'->'ı' dogru islenir; buyuk/kucuk
 * ayrimi kalkar ama 'ü/ö/ç/ş/ğ/ı' harfleri esitlenmez. Boylece 'Su' ile 'Süt' AYRILIR
 * (kullanici istegi): 'su' araminca 'süt' cikmaz, ama 'SÜT' == 'süt'.
 */
export function trNormalize(s: string): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Exchange (Doviz-Altin) imzasi: DailyExpenses.tsx isExchangeEntry ile ayni ---

const EXCHANGE_KUR = /\(Kur:/;
const EXCHANGE_TAKAS = /\(Takas\)/;
const EXCHANGE_DONUSUM = /^Dönüşüm (Çıkışı|Girişi):/;
const EXCHANGE_TLLEG = /^(Altın|Döviz) (Alımı|Satışı):\s*\d/;

function isExchangeDaily(e: DailyExpense): boolean {
  if (typeof e.id === 'string' && e.id.startsWith('vault-curr-')) return true;
  const d = String(e.description ?? '').trim();
  if (!d) return false;
  return EXCHANGE_KUR.test(d) || EXCHANGE_TAKAS.test(d) || EXCHANGE_DONUSUM.test(d) || EXCHANGE_TLLEG.test(d);
}

// --- Turetilmis/otomatik kayit elemesi ---

const DERIVED_PREFIXES = ['proj-', 'bill-cc-', 'bill-cash-', 'stmtbill-', 'vault-curr-', 'allowance-'];
function isDerivedId(id?: string): boolean {
  return typeof id === 'string' && DERIVED_PREFIXES.some(p => id.startsWith(p));
}

// Bir faturanin/kasa kaydinin SENTETIK IKIZI: kaynak kayit ayrica indekslendigi icin bunlar elenir.
// 'proj-'/'allowance-' BURADA YOK: ham dizide (realState/history/futureData) gorunen bir 'proj-bill-'/
// 'proj-rent-' CANLI projeksiyon degil, TERFI ETMIS gercek bir kayittir (kullanici o ayi gelecekken
// maddelestirmis, devir terfi etmis) ve DOM satiri ayni id ile vardir -> indekslenmeli, deep-link kirilmaz.
// ('proj-cc-debt-' zaten CC_DEBT_TITLE ile, harclik zaten isAllowance ile elenir; asagida fixedLeg.)
const SYNTHETIC_TWIN_PREFIXES = ['bill-cc-', 'bill-cash-', 'stmtbill-', 'vault-curr-'];
function isSyntheticTwinId(id?: string): boolean {
  return typeof id === 'string' && SYNTHETIC_TWIN_PREFIXES.some(p => id.startsWith(p));
}
// BudgetContext.CC_DEBT_TITLE ile ayni (dongusel import olmasin diye burada sabit).
const CC_DEBT_TITLE = 'Kredi Kartı Borcu (Geçen Ay)';

// --- Arama kaydi ---

export type SearchKind = 'daily' | 'exchange' | 'ccdebt' | 'installment' | 'bill' | 'fixed' | 'income' | 'vault';

export interface SearchRecord {
  /** DOM eslesmesi + tekillik icin dogal anahtar: `${tag}:${id}`. Satirdaki data-search-key ile birebir. */
  key: string;
  /** Ekranda gosterilen baslik. */
  title: string;
  /** Eslesme icin normalize edilmis "saman yigini" (baslik + varsa sahip/tur). */
  normTitle: string;
  /** Isaretli tutar (gider negatif, gelir pozitif). */
  amount: number;
  /** Tutar birimi: 'try' -> ₺, 'asset' -> adet/gram/doviz. */
  amountKind: 'try' | 'asset';
  /** 'asset' ise birim etiketi icin tur kodu (Dolar/Gram...). */
  assetType?: string;
  /** ISO YYYY-MM-DD (en iyi mevcut). */
  date: string;
  /** Kaydin bulundugu ay kovasi (YYYY-MM) — deep-link setViewDate hedefi. */
  month: string;
  /** Rozet etiketi: 'TL (Nakit)' / 'Yemek Kartı' / 'Kredi Kartı' / 'Fatura · ...' / altin turu. */
  label: string;
  kind: SearchKind;
  /** Deep-link rotasi. */
  route: string;
  /** Islemler alt-sekmesi. */
  subTab?: 'NORMAL' | 'EXCHANGE' | 'BILLS';
  /** Islemler Doviz-Altin modu. */
  exchangeMode?: 'CURRENCY' | 'GOLD';
  /** Islemler varlik sekmesi (daily_draft_tab degeri). */
  assetTab?: string;
  /** Taksit rozeti (n/total). */
  installmentInfo?: { current: number; total: number };
}

const KIND_TAG: Record<SearchKind, string> = {
  daily: 'tx', exchange: 'tx', ccdebt: 'debt', installment: 'inst',
  bill: 'bill', fixed: 'fixed', income: 'income', vault: 'vault',
};

/** DOM veri-anahtari uretir; hem indeks hem liste satiri AYNI fonksiyonu kullanir. */
export function searchKeyFor(kind: SearchKind, id: string): string {
  return `${KIND_TAG[kind]}:${id}`;
}

function assetLabel(type?: string): string {
  const t = String(type ?? 'NAKIT');
  if (t === 'NAKIT' || t === '') return 'TL (Nakit)';
  if (t === 'YK') return 'Yemek Kartı';
  return getAssetFullTitle(t);
}

function amountKindOf(type?: string): 'try' | 'asset' {
  const t = String(type ?? 'NAKIT');
  return (t === 'NAKIT' || t === 'YK' || t === '') ? 'try' : 'asset';
}

// Kasa (GoldRecord) isaretli tutari: getKasaSum ile ayni yon mantigi.
function vaultSignedAmount(r: GoldRecord): number {
  const amt = Math.abs(Number(r.amount) || 0);
  const t = r.transaction_type || 'Birikim';
  const isIn = t === 'Birikim' || t === 'Giriş' || t === 'Bütçe Geliri';
  return isIn ? amt : -amt;
}

// --- Indeks kurucu ---

export function buildSearchIndex(state: BudgetState, vaultRecords: GoldRecord[]): SearchRecord[] {
  const out: SearchRecord[] = [];
  const add = (r: Omit<SearchRecord, 'normTitle'> & { normHay?: string }) => {
    const { normHay, ...rest } = r;
    out.push({ ...rest, normTitle: trNormalize(normHay ?? rest.title) });
  };

  const dailyLeg = (e: DailyExpense, month: string) => {
    if (isDerivedId(e.id)) return;
    const desc = String(e.description ?? '').trim();
    if (!desc) return;
    const exchange = isExchangeDaily(e);
    const gold = isGoldType(e.type);
    const isTLLeg = e.type === 'NAKIT';
    add({
      key: searchKeyFor('daily', e.id),
      title: desc,
      amount: Number(e.amount) || 0,
      amountKind: amountKindOf(e.type),
      assetType: e.type,
      date: e.date || `${month}-01`,
      month,
      label: assetLabel(e.type),
      kind: exchange ? 'exchange' : 'daily',
      route: '/islemler',
      // TL-maliyet bacagi NORMAL/NAKIT'te de gorunur (en sade hedef); diger bacaklar EXCHANGE.
      subTab: exchange && !isTLLeg ? 'EXCHANGE' : 'NORMAL',
      exchangeMode: exchange && !isTLLeg ? (gold ? 'GOLD' : 'CURRENCY') : undefined,
      assetTab: e.type,
    });
  };

  const ccLeg = (d: CCDebt, month: string) => {
    if (isDerivedId(d.id)) return;
    const desc = String(d.description ?? '').trim();
    if (!desc) return;
    add({
      key: searchKeyFor('ccdebt', d.id),
      title: desc,
      amount: Number(d.amount) || 0,
      amountKind: 'try',
      date: d.date || `${month}-01`,
      month,
      label: 'Kredi Kartı',
      kind: 'ccdebt',
      route: '/borc',
      installmentInfo: d.totalInstallments
        ? { current: Number(d.currentInstallment) || 0, total: Number(d.totalInstallments) || 0 }
        : undefined,
    });
  };

  const fixedLeg = (fx: FixedExpense, month: string) => {
    // Sentetik ikiz (stmtbill- vb.) elenir; ama TERFI ETMIS proj-bill-/proj-rent- indekslenir.
    if (isSyntheticTwinId(fx.id)) return;
    // GELECEK aya maddelestirilmis, TUTARSIZ (amount 0) projeksiyon placeholder'i aramada gurultu
    // yapar (or. her ay tekrar eden 'Su Faturası: +0 ₺'). Bunlari ele; ama cari/gecmis aydaki terfi
    // etmis gercek proj- (or. odenmis fatura) VE tutari girilmis gelecek planlari KALIR.
    if (month > curMonth && fx.id.startsWith('proj-') && (Number(fx.amount) || 0) === 0) return;
    if (fx.isAllowance) return;
    // PLANNED_VAULT: varlik alim PLANI (gercek kayit degil); ayri bolumde gorunur, listede satiri yok.
    if (fx.type === 'PLANNED_VAULT') return;
    const title = String(fx.title ?? '').trim();
    if (!title || title === CC_DEBT_TITLE) return;
    const bill = !!fx.isBill;
    add({
      key: searchKeyFor(bill ? 'bill' : 'fixed', fx.id),
      title,
      amount: -Math.abs(Number(fx.amount) || 0),
      amountKind: amountKindOf(fx.type),
      assetType: fx.type,
      date: fx.date || `${month}-01`,
      month,
      label: bill
        ? `Fatura · ${fx.paymentMethod === 'KK' ? 'Kredi Kartı' : assetLabel(fx.type)}`
        : assetLabel(fx.type),
      kind: bill ? 'bill' : 'fixed',
      route: bill ? '/islemler' : '/varliklarim',
      subTab: bill ? 'BILLS' : undefined,
    });
  };

  const incomeLeg = (inc: CustomIncome, month: string) => {
    if (isDerivedId(inc.id)) return;
    if (inc.type === 'PLANNED_VAULT') return;
    const title = String(inc.title ?? '').trim();
    if (!title) return;
    add({
      key: searchKeyFor('income', inc.id),
      title,
      amount: Math.abs(Number(inc.amount) || 0),
      amountKind: amountKindOf(inc.type),
      assetType: inc.type,
      date: `${month}-01`,
      month,
      label: assetLabel(inc.type),
      kind: 'income',
      route: '/varliklarim',
    });
  };

  const curMonth = state.currentMonth;

  // Cari ay (realState)
  (state.dailyExpenses || []).forEach(e => dailyLeg(e, curMonth));
  (state.ccDebts || []).forEach(d => ccLeg(d, curMonth));
  (state.fixedExpenses || []).forEach(fx => fixedLeg(fx, curMonth));
  (state.customIncomes || []).forEach(inc => incomeLeg(inc, curMonth));

  // Taksitler (ay-ustu; cari aya baglanir)
  (state.installments || []).forEach((inst: Installment) => {
    const title = String(inst.description ?? '').trim();
    if (!title) return;
    add({
      key: searchKeyFor('installment', inst.id),
      title,
      amount: -Math.abs(Number(inst.monthlyAmount) || 0),
      amountKind: 'try',
      date: inst.startDate || `${curMonth}-01`,
      month: curMonth,
      label: 'Kredi Kartı (Taksit)',
      kind: 'installment',
      route: '/borc',
      installmentInfo: {
        current: Math.max(0, (Number(inst.installmentCount) || 0) - (Number(inst.remainingInstallments) || 0)),
        total: Number(inst.installmentCount) || 0,
      },
    });
  });

  // Gecmis aylar (history)
  (state.history || []).forEach(h => {
    const m = h.month;
    (h.dailyExpenses || []).forEach(e => dailyLeg(e, m));
    (h.ccDebts || []).forEach(d => ccLeg(d, m));
    (h.fixedExpenses || []).forEach(fx => fixedLeg(fx, m));
    (h.customIncomes || []).forEach(inc => incomeLeg(inc, m));
  });

  // Gelecek aylar (futureData) — yalniz elle eklenen gercek kayitlar.
  // KRITIK: Ay devri futureData[cari-ay]'i SILMEZ; icerigi realState'e terfi ettikten sonra
  // bayat kalir. m <= curMonth kovalarini atlayarak ayni kaydin cift indekslenmesini onle.
  Object.entries(state.futureData || {}).forEach(([m, fd]) => {
    if (m <= curMonth) return;
    (fd.ccDebts || []).forEach(d => ccLeg(d, m));
    (fd.fixedExpenses || []).forEach(fx => fixedLeg(fx, m));
    (fd.customIncomes || []).forEach(inc => incomeLeg(inc, m));
  });

  // Kasa (backend gold_records) — altin + doviz
  (vaultRecords || []).forEach(r => {
    if (!r || !r.gold_type) return;
    const month = String(r.record_date ?? '').substring(0, 7) || curMonth;
    const gold = isGoldType(r.gold_type);
    const note = String(r.note ?? '').trim();
    const owner = String(r.owner ?? '').trim();
    const typeName = getAssetFullTitle(r.gold_type);
    const title = note || owner || typeName;
    if (gold) {
      // Altin kasasi Varliklarim > Kasa bileseninde; tek bolum capasina kaydirilir.
      add({
        key: 'vaultsection',
        title,
        normHay: [title, owner, typeName, r.gold_type].join(' '),
        amount: vaultSignedAmount(r),
        amountKind: 'asset',
        assetType: r.gold_type,
        date: r.record_date || `${month}-01`,
        month,
        label: typeName,
        kind: 'vault',
        route: '/varliklarim',
      });
    } else {
      // Doviz kasasi Islemler EXCHANGE'de 'vault-curr-<id>' satiri olarak gorunur.
      add({
        key: searchKeyFor('daily', `vault-curr-${r.id}`),
        title,
        normHay: [title, owner, typeName, r.gold_type].join(' '),
        amount: vaultSignedAmount(r),
        amountKind: 'asset',
        assetType: r.gold_type,
        date: r.record_date || `${month}-01`,
        month,
        label: typeName,
        kind: 'vault',
        route: '/islemler',
        subTab: 'EXCHANGE',
        exchangeMode: 'CURRENCY',
        assetTab: r.gold_type,
      });
    }
  });

  // Guvenlik agi: ayni kaydin (ayni key) birden fazla kovadan okunmasina karsi tekillestir.
  // Vault haric (tum altin kasasi kayitlari 'vaultsection' anahtarini paylasir).
  const seen = new Set<string>();
  return out.filter(r => {
    if (r.kind === 'vault') return true;
    if (seen.has(r.key)) return false;
    seen.add(r.key);
    return true;
  });
}

// --- Sorgu suzgeci (tuketen bilesende debounce ile cagirilir) ---

/** Sayisal sorgu: ayraclari (1.500,00) at, mutlak deger karsilastirmasi icin sade rakam dizisi dondur. */
function numericQuery(q: string): string | null {
  const cleaned = q.replace(/[.\s₺]/g, '').replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(cleaned)) return cleaned.replace(/\.0+$/, '');
  return null;
}

export function filterSearchIndex(index: SearchRecord[], query: string, limit = 50): SearchRecord[] {
  const q = trNormalize(query);
  if (q.length < 2) return [];
  const num = numericQuery(query);
  const matches = index.filter(r => {
    if (r.normTitle.includes(q)) return true;
    if (num) {
      const abs = Math.round(Math.abs(r.amount));
      if (String(abs).includes(num)) return true;
    }
    return false;
  });
  // Tarih azalan (yeni -> eski); UI ay basligiyla gruplar.
  matches.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return matches.slice(0, limit);
}
