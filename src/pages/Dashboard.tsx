import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ChevronDown, ChevronUp, Utensils, CreditCard, Check, X, Gift } from 'lucide-react';
import { SwipeNavCard } from '../components/SwipeNavCard';
import { MobileProfileMenu } from '../components/MobileProfileMenu';
import { SearchTrigger } from '../components/SearchTrigger';
import { PrivacyTrigger } from '../components/PrivacyTrigger';
import { Secret } from '../components/Secret';
import { MonthNavigator } from '../components/MonthNavigator';
import { useBudget } from '../context/BudgetContext';
import { isDebtPending } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { ProgressBar } from '../components/ui/ProgressBar';

const isGoldType = (type: string) => {
  const lower = type.toLowerCase();
  const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
  return goldKeywords.some(kw => lower.includes(kw));
};

// Döviz -> renk anahtarı. Depolanan değer genelde ISO kod (USD, SYP, RUB…) ama
// eski/serbest metin kayıtlar için ad bazlı geniş eşleşme de var.
const currencyColorKey = (name: string): string => {
  const lower = name.trim().toLowerCase();
  const direct: Record<string, string> = {
    usd: 'usd', dolar: 'usd', 'amerikan doları': 'usd',
    eur: 'eur', euro: 'eur',
    gbp: 'gbp', sterlin: 'gbp', 'ingiliz sterlini': 'gbp',
    syp: 'syp', 'suriye lirası': 'syp',
    rub: 'rub', ruble: 'rub', 'rus rublesi': 'rub',
    azn: 'azn', manat: 'azn', 'azerbaycan manatı': 'azn',
    sar: 'sar', 'suudi arabistan riyali': 'sar',
    egp: 'egp', 'mısır lirası': 'egp',
    lbp: 'lbp', 'lübnan lirası': 'lbp',
    uzs: 'uzs', som: 'uzs', 'özbekistan somu': 'uzs',
    bam: 'bam', 'bosna-hersek markı': 'bam', 'bosna markı': 'bam',
    irr: 'irr', 'iran riyali': 'irr',
  };
  if (direct[lower]) return direct[lower];
  // Serbest/eski metin için ad bazlı yakalama ('iran' testi, 'riyal'den ÖNCE)
  if (lower.includes('iran')) return 'irr';
  if (lower.includes('lübnan') || lower.includes('lubnan')) return 'lbp';
  if (lower.includes('özbek') || lower.includes('ozbek')) return 'uzs';
  if (lower.includes('suriye') || lower.includes('syrian')) return 'syp';
  if (lower.includes('suudi') || lower.includes('riyal')) return 'sar';
  if (lower.includes('mısır') || lower.includes('misir')) return 'egp';
  if (lower.includes('azerbaycan') || lower.includes('manat')) return 'azn';
  if (lower.includes('ruble') || lower.includes('rublesi')) return 'rub';
  if (lower.includes('bosna') || lower.includes('marki') || lower.includes('markı')) return 'bam';
  if (lower.includes('dolar') || lower.includes('dollar')) return 'usd';
  if (lower.includes('euro')) return 'eur';
  if (lower.includes('sterlin') || lower.includes('pound')) return 'gbp';
  return '';
};

// Her döviz için kart + değer renk sınıfları. Tailwind JIT taraması için TAM literal
// stringler (dinamik `to-${x}` üretilirse purge eder, renk çıkmaz).
const CURRENCY_COLORS: Record<string, { card: string; value: string }> = {
  usd: { card: 'to-green-500/12 border-green-500/30', value: 'text-green-600 dark:text-green-500' },
  eur: { card: 'to-blue-500/12 border-blue-500/30', value: 'text-blue-600 dark:text-blue-500' },
  gbp: { card: 'to-purple-500/12 border-purple-500/30', value: 'text-purple-600 dark:text-purple-500' },
  syp: { card: 'to-red-500/12 border-red-500/30', value: 'text-red-600 dark:text-red-500' },
  rub: { card: 'to-indigo-500/12 border-indigo-500/30', value: 'text-indigo-600 dark:text-indigo-500' },
  azn: { card: 'to-sky-500/12 border-sky-500/30', value: 'text-sky-600 dark:text-sky-500' },
  sar: { card: 'to-lime-500/12 border-lime-500/30', value: 'text-lime-600 dark:text-lime-500' },
  egp: { card: 'to-orange-500/12 border-orange-500/30', value: 'text-orange-600 dark:text-orange-500' },
  lbp: { card: 'to-cyan-500/12 border-cyan-500/30', value: 'text-cyan-600 dark:text-cyan-500' },
  uzs: { card: 'to-pink-500/12 border-pink-500/30', value: 'text-pink-600 dark:text-pink-500' },
  bam: { card: 'to-teal-500/12 border-teal-500/30', value: 'text-teal-600 dark:text-teal-500' },
  irr: { card: 'to-rose-500/12 border-rose-500/30', value: 'text-rose-600 dark:text-rose-500' },
};

const FALLBACK_CURRENCY_COLOR = { card: 'to-slate-500/12 border-slate-500/30', value: 'text-slate-600 dark:text-slate-400' };

const getCurrencyColors = (asset: string) => CURRENCY_COLORS[currencyColorKey(asset)] || FALLBACK_CURRENCY_COLOR;

// Döviz kartı: tam ad kutuya (tek satıra) SIĞMIYORSA ISO koduna düşer (ölçümle; masaüstü/
// mobil ayrımı gerekmez). Kısaltılmışsa KARTIN HERHANGİ bir yerine dokununca (mobil) veya
// fareyle üzerine gelince tam adı tooltip'te gösterir; dışarı dokununca kapanır.
function CurrencyAssetCard({ fullTitle, isoCode, symbol, value, colors }: {
  fullTitle: string;
  isoCode: string;
  symbol: string;
  value: number;
  colors: { card: string; value: string };
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLHeadingElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const box = labelRef.current;
      const m = measureRef.current;
      if (!box || !m) return;
      // Tam adin tek satirdaki dogal genisligi etiket alanina sigmiyorsa -> koda dön.
      setTruncated(m.scrollWidth > box.clientWidth + 0.5);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fullTitle, isoCode]);

  const canReveal = truncated && isoCode !== fullTitle;

  // Dışarı tıklayınca kapat. contains() ile: kartın KENDİ tıklaması (açan tap) asla
  // kapatmaz; yalnızca kart DIŞINA tıklama kapatır. Böylece mobildeki "aç-anında-kapan"
  // zamanlama yarışı tamamen biter.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative p-4 rounded-xl glass bg-gradient-to-br from-transparent ${colors.card} ${canReveal ? 'cursor-pointer' : ''}`}
      onClick={() => { if (canReveal) setOpen(o => !o); }}
    >
      <h3 ref={labelRef} className="relative block text-sm font-medium text-muted-foreground mb-1">
        {/* Gizli olcum: tam ad, tek satir, dogal genislik */}
        <span ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">{fullTitle}</span>
        <span className="block truncate" aria-label={canReveal ? fullTitle : undefined}>{canReveal ? isoCode : fullTitle}</span>
      </h3>
      <div className={`text-2xl font-bold mt-2 ${value < 0 ? 'text-red-500' : colors.value}`}>
        <Secret>{value.toLocaleString('tr-TR')}{symbol}</Secret>
      </div>
      {/* Tam ad tooltip: kartın ÜSTÜNDE, aşağı bakan ok ile */}
      {open && canReveal && (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
          <div className="relative whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-lg">
            {fullTitle}
            <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-popover" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { state, viewDate, showMealCard, vaultRecords, activeCurrencies, todayStr, allVaultRecords, acceptVaultRecord, rejectVaultRecord } = useBudget();

  // Altin emanetleri (yalniz gorunum icin tam liste 'allVaultRecords'tan): bana gelen bekleyenler
  // (kabul/ret) ve benim baskasina emanet ettiklerim (durum). Sayilan toplamlar 'vaultRecords'ta.
  const incomingPending = (allVaultRecords || []).filter(r => r.relation === 'incoming' && r.owner_status === 'pending');
  const sentGold = (allVaultRecords || []).filter(r => r.relation === 'sent');

  // Track window size for responsive chart rendering
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dokunulan dilimin bilgisi donut MERKEZİNDE gösterilir (uçan tooltip yok).
  // null iken merkez toplam bütçeyi gösterir. Dışarı dokununca temizlenir.
  const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (chartRef.current && !chartRef.current.contains(e.target as Node)) setActiveSliceIndex(null);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const [isVaultExpanded, setIsVaultExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('dashboard_vault_expanded');
      return stored !== 'false';
    } catch {
      return true;
    }
  });

  // Returns the symbol or short code to display next to numbers
  const getAssetSymbol = (name: string): string => {
    const lower = name.trim().toLowerCase();

    // Gold types: keep short name (Gram, Çeyrek…)
    if (isGoldType(name)) {
      if (lower.endsWith(' altın')) return name.substring(0, name.length - 6);
      return name;
    }

    const mapping: Record<string, string> = {
      // TL
      'nakit': '₺', 'tl': '₺',
      // USD
      'usd': '$', 'dolar': '$', 'amerikan doları': '$',
      // EUR
      'eur': '€', 'euro': '€',
      // GBP
      'gbp': '£', 'sterlin': '£', 'ingiliz sterlini': '£',
      // CHF
      'chf': '₣', 'frang': '₣', 'isviçre frangı': '₣',
      // CAD
      'cad': 'C$', 'kanada doları': 'C$',
      // AUD
      'aud': 'A$', 'avustralya doları': 'A$',
      // RUB
      'rub': '₽', 'ruble': '₽', 'rus rublesi': '₽',
      // JPY
      'jpy': '¥', 'yen': '¥', 'japon yeni': '¥',
      // CNY
      'cny': '¥', 'yuan': '¥', 'çin yuanı': '¥',
      // SAR
      'sar': '﷼', 'riyali': '﷼', 'suudi arabistan riyali': '﷼',
      // QAR
      'qar': '﷼', 'katar riyali': '﷼',
      // AED
      'aed': 'د.إ', 'dirhem': 'د.إ', 'birleşik arap emirlikleri dirhemi': 'د.إ',
      // KWD
      'kwd': 'د.k', 'dinar': 'د.k', 'kuveyt dinarı': 'د.k',
      // IQD
      'iqd': 'د.ع', 'irak dinarı': 'د.ع',
      // BAM
      'bam': 'KM', 'bosna-hersek markı': 'KM',
      // SYP
      'syp': 'ل.س', 'suriye lirası': 'ل.س',
      // LBP
      'lbp': 'L£', 'lübnan lirası': 'L£',
      // UZS
      'uzs': "so'm", 'özbekistan somu': "so'm",
      // IRR
      'irr': '﷼', 'iran riyali': '﷼',
      // AZN
      'azn': '₼', 'azerbaycan manatı': '₼', 'manat': '₼',
      // UAH
      'uah': '₴', 'ukrayna grivnası': '₴',
      // INR
      'inr': '₹', 'hindistan rupisi': '₹',
      // EGP
      'egp': 'E£', 'mısır lirası': 'E£',
      // KRW
      'krw': '₩', 'güney kore wonu': '₩',
      // SEK / NOK / DKK
      'sek': 'kr', 'nok': 'kr', 'dkk': 'kr',
      'isveç kronu': 'kr', 'norveç kronu': 'kr', 'danimarka kronu': 'kr',
    };

    return mapping[lower] || name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const getAssetFullTitle = (name: string): string => {
    const lower = name.trim().toLowerCase();

    // Gold types
    if (isGoldType(name)) {
      if (lower.includes('altın') || lower.includes('lira')) return name;
      if (lower === 'gram') return 'Gram Altın';
      if (lower === 'çeyrek') return 'Çeyrek Altın';
      if (lower === 'yarım') return 'Yarım Altın';
      if (lower === 'tam') return 'Tam Altın';
      if (lower === 'ata') return 'Ata Altın';
      if (lower === 'reşat') return 'Reşat Altın';
      if (lower === 'bilezik') return 'Bilezik Altın';
      if (lower === 'külçe') return 'Külçe Altın';
      return `${name} Altın`;
    }

    const mapping: Record<string, string> = {
      'nakit': 'Türk Lirası', 'tl': 'Türk Lirası',
      'bam': 'Bosna-Hersek Markı', 'bosna-hersek markı': 'Bosna-Hersek Markı',
      'usd': 'Amerikan Doları', 'dolar': 'Amerikan Doları', 'amerikan doları': 'Amerikan Doları',
      'eur': 'Euro', 'euro': 'Euro',
      'gbp': 'İngiliz Sterlini', 'sterlin': 'İngiliz Sterlini', 'ingiliz sterlini': 'İngiliz Sterlini',
      'chf': 'İsviçre Frangı', 'frang': 'İsviçre Frangı', 'isviçre frangı': 'İsviçre Frangı',
      'cad': 'Kanada Doları', 'kanada doları': 'Kanada Doları',
      'aud': 'Avustralya Doları', 'avustralya doları': 'Avustralya Doları',
      'rub': 'Rus Rublesi', 'ruble': 'Rus Rublesi', 'rus rublesi': 'Rus Rublesi',
      'jpy': 'Japon Yeni', 'yen': 'Japon Yeni', 'japon yeni': 'Japon Yeni',
      'cny': 'Çin Yuanı', 'yuan': 'Çin Yuanı', 'çin yuanı': 'Çin Yuanı',
      'sar': 'Suudi Arabistan Riyali', 'riyali': 'Suudi Arabistan Riyali', 'suudi arabistan riyali': 'Suudi Arabistan Riyali',
      'qar': 'Katar Riyali', 'katar riyali': 'Katar Riyali',
      'aed': 'Birleşik Arap Emirlikleri Dirhemi', 'dirhem': 'Birleşik Arap Emirlikleri Dirhemi', 'birleşik arap emirlikleri dirhemi': 'Birleşik Arap Emirlikleri Dirhemi',
      'kwd': 'Kuveyt Dinarı', 'dinar': 'Kuveyt Dinarı', 'kuveyt dinarı': 'Kuveyt Dinarı',
      'iqd': 'Irak Dinarı', 'irak dinarı': 'Irak Dinarı',
      'syp': 'Suriye Lirası', 'suriye lirası': 'Suriye Lirası',
      'lbp': 'Lübnan Lirası', 'lübnan lirası': 'Lübnan Lirası',
      'uzs': 'Özbekistan Somu', 'som': 'Özbekistan Somu', 'özbekistan somu': 'Özbekistan Somu',
      'irr': 'İran Riyali', 'iran riyali': 'İran Riyali',
      'azn': 'Azerbaycan Manatı', 'manat': 'Azerbaycan Manatı', 'azerbaycan manatı': 'Azerbaycan Manatı',
      'uah': 'Ukrayna Grivnası', 'ukrayna grivnası': 'Ukrayna Grivnası',
      'inr': 'Hindistan Rupisi', 'hindistan rupisi': 'Hindistan Rupisi',
      'egp': 'Mısır Lirası', 'mısır lirası': 'Mısır Lirası',
      'krw': 'Güney Kore Wonu', 'güney kore wonu': 'Güney Kore Wonu',
      'sek': 'İsveç Kronu', 'isveç kronu': 'İsveç Kronu',
      'nok': 'Norveç Kronu', 'norveç kronu': 'Norveç Kronu',
      'dkk': 'Danimarka Kronu', 'danimarka kronu': 'Danimarka Kronu',
    };

    const fallback = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return mapping[lower] || fallback;
  };

  // Uzun döviz adları için uluslararası ISO kısaltması (BAM, USD, GBP…).
  const getAssetIsoCode = (asset: string): string => {
    const t = asset.trim();
    if (/^[A-Za-zÇĞİıÖŞÜçğıöşü]{2,4}$/.test(t)) return t.toUpperCase();
    const key = currencyColorKey(asset);
    if (key) return key.toUpperCase();
    const codeMap: Record<string, string> = {
      'isviçre frangı': 'CHF', 'kanada doları': 'CAD', 'avustralya doları': 'AUD',
      'japon yeni': 'JPY', 'çin yuanı': 'CNY', 'katar riyali': 'QAR',
      'birleşik arap emirlikleri dirhemi': 'AED', 'kuveyt dinarı': 'KWD', 'irak dinarı': 'IQD',
      'ukrayna grivnası': 'UAH', 'hindistan rupisi': 'INR', 'güney kore wonu': 'KRW',
      'isveç kronu': 'SEK', 'norveç kronu': 'NOK', 'danimarka kronu': 'DKK',
    };
    return codeMap[t.toLowerCase()] || t.substring(0, 3).toUpperCase();
  };



  // Calculations based on Derived State
  // Note: Derived State has already projected values for future months.

  // YK Resources
  const ykIncome = state.ykIncome || 0;
  const ykRollover = state.ykRollover || 0;
  // Daily YK Income only exists in current/past. Future is 0.
  const dailyYkIncome = state.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'YK')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalYkResources = ykIncome + ykRollover + dailyYkIncome;

  const ykSpent = state.dailyExpenses
    .filter(e => e.type === 'YK' && e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const finalRemainingYk = totalYkResources - ykSpent;

  // Cash Resources
  // Daily Cash Income only exists in current/past. Future is 0.
  const dailyCashIncome = state.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'NAKIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const customIncomeTotal = (state.customIncomes || []).reduce((sum, e) => sum + e.amount, 0);

  const totalCashResources = state.income + state.rollover + dailyCashIncome + customIncomeTotal;

  // Expenses
  // For Current/Past: Paid Fixed Expenses + Cash Spent
  // For Future: Total Fixed Expenses (Projection assumes all will be paid)
  // But wait, 'remainingCash' usually means "Available right now".
  // If I look at next month, I want to see "Projected Ending Balance" or "Projected Remaining"?
  // Usually "Projected Remaining" = Income - All Expenses.

  // Let's differentiate:
  // Is it Current/Past?
  // Current: Show Actual Remaining (Total - Paid - Spent).
  // Future: Show Projected Remaining (Total - All Fixed).
  // History: Show Final Remaining (Total - Paid - Spent).

  // We can just use the generic logic:
  // "Paid" fixed expenses.
  // In future, none are "Paid" (unless marked manually).
  // But for projection, we want to see "Net Balance".
  // If I show "Remaining: 20.000" in Next Month, and I have 5.000 Rent (Unpaid),
  // Does "Remaining" mean "Money currently in pocket (virtual)" or "Money left after bills"?
  // Usually "Money left after bills".
  // So for Future, we should treat ALL Fixed Expenses as "To Be Paid" and subtract them from Total Resources?
  // If I do that, the user sees how much "Safe to Spend" money they have.

  // Let's check `state.fixedExpenses`.
  // In Future projection (BudgetContext), we initialized them as `isPaid: false`.

  // Logic:
  // If Future: Subtract sum of ALL fixed expenses.
  // If Current/Past: Subtract sum of PAID fixed expenses + Daily Spent.

  const getLocalMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isFuture = viewDate > getLocalMonth();

  let totalCashSpent = 0;
  let spendingLabel = "Harcama";

  if (isFuture) {
      // Future Projection Mode
      // Assume all fixed expenses will be paid
      // PLANNED_VAULT is a cash expense. So we include it in totalCashSpent.
      const totalFixed = state.fixedExpenses
        .filter(e => e.paymentMethod !== 'KK')
        .reduce((sum, e) => sum + e.amount, 0);
      totalCashSpent = totalFixed;
      // No daily expenses in future
      spendingLabel = "Planlanan Gider";
  } else {
      // Normal Mode
      // Treat PLANNED_VAULT as fixed expense. It is 'unpaid' until executed, but wait, the plan asks:
      // "but add their sum to totalCashExpense" -> this means we should act as if they are paid or just include them in the total.
      // Wait, in Varlıklarım page, we add PLANNED_VAULT to "Türk Lirası Toplam Gider".
      // But they are not "isPaid" until we execute them (they get deleted and become a DailyExpense).
      // So while they exist, should they reduce the "Kalan TL" in Dashboard? Yes, they reserve money.
      // So we should add ALL PLANNED_VAULT expenses to `paidFixed` (or treat them as reserved).
      const paidFixed = state.fixedExpenses
        .filter(e => (e.isPaid || e.type === 'PLANNED_VAULT') && !e.isBill)
        .reduce((sum, e) => sum + e.amount, 0);

      const cashSpent = state.dailyExpenses
        .filter(e => e.amount < 0 && e.type === 'NAKIT')
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

      totalCashSpent = paidFixed + cashSpent;
  }

  const remainingCash = totalCashResources - totalCashSpent;

  // Ayın kalan günü (bugün dâhil) ve kalan bakiyeye göre günlük ortalama.
  // Yalnızca içinde bulunulan ay için anlamlıdır.
  const isCurrentMonth = viewDate === getLocalMonth();
  const daysLeftInMonth = (() => {
    const d = new Date();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return daysInMonth - d.getDate() + 1;
  })();
  const dailyAvgCash = daysLeftInMonth > 0 ? remainingCash / daysLeftInMonth : remainingCash;
  const dailyAvgYk = daysLeftInMonth > 0 ? finalRemainingYk / daysLeftInMonth : finalRemainingYk;
  // Yuvarlama yapmadan virgülden sonraki ilk 2 haneyi göster (kırparak).
  const truncTo2 = (n: number) => Math.trunc(n * 100) / 100;

  // CC Debt
  // In future, CC Debts list contains "Projected Installments".
  // We sum them up.
  // Gunu gelmemis (bu ayda ileri tarihli) borclar toplama girmez (Kredi Karti
  // sayfasiyla ayni kural, ortak isDebtPending). Gelecek/gecmis aylarda tam sayilir.
  const totalCCDebt = Math.abs(
    state.ccDebts
      .filter(d => !isDebtPending(d.date, isCurrentMonth, todayStr))
      .reduce((sum, d) => sum + d.amount, 0)
  );
  
  // Progress Bar
  // If future, usage = fixed expenses / income
  const usagePercentage = totalCashResources > 0 ? (totalCashSpent / totalCashResources) * 100 : 0;

  // Pie Chart Data
  const pieData: { name: string; value: number; fill?: string; color?: string }[] = [];
  // Sabit gider dilimleri için uyumlu, yumuşatılmış palet. Semantik renkler
  // (Kalan=yeşil, Harcama=kırmızı, Yatırım=sarı) burada YOK; onlar ayrıca atanıyor.
  const COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f472b6', '#3b82f6', '#a855f7', '#06b6d4'];

  // The pie chart must represent the TOTAL MONTHLY INCOME.
  let totalBudgetedFixed = 0;

  // Prepare fixed expenses alphabetically
  // Include PLANNED_VAULT as they are fixed expenses (budgeted)
  const validFixedExpenses = state.fixedExpenses
    .filter(e => e.amount > 0 && (e.type === 'NAKIT' || e.type === 'PLANNED_VAULT' || !e.type) && !e.isBill)
    .map(e => ({
      ...e,
      title: e.type === 'PLANNED_VAULT' ? (e.title || `Planlanan ${e.vault_gold_type} Alımı`) : e.title
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'tr'));

  // Calculate daily expenses summary slices
  const nakitExpenses = state.dailyExpenses.filter(e => e.type === 'NAKIT' && e.amount < 0);

  // Separate Investment/Savings (Altın/Döviz Alımı) from regular daily expenses
  const isInvestment = (desc: string | undefined | null) => {
    if (!desc) return false;
    const lower = desc.toLowerCase();
    return lower.includes('altın alımı') ||
           lower.includes('döviz alımı') ||
           lower.includes(' alımı') ||
           lower.includes('planlanan'); // Include "Planlanan Gram Alımı" etc
  };

  const investmentSpentTotal = nakitExpenses
      .filter(e => isInvestment(e.description))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const standardDailySpentTotal = nakitExpenses
      .filter(e => !isInvestment(e.description))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const totalDailyCashSpent = investmentSpentTotal + standardDailySpentTotal;

  // The remaining pie slice is (Total Resources - ALL Fixed Expenses - Total Daily Spent)
  validFixedExpenses.forEach(e => totalBudgetedFixed += e.amount);
  const trueRemaining = totalCashResources - totalBudgetedFixed - (isFuture ? 0 : totalDailyCashSpent);

  // 1. Kalan TL / Bütçe Açığı
  if (trueRemaining > 0) {
      pieData.push({
          name: 'Kalan TL',
          value: trueRemaining,
          color: '#22c55e' // green-500
      });
  } else if (trueRemaining < 0) {
      pieData.push({
          name: 'Bütçe Açığı',
          value: Math.abs(trueRemaining),
          color: '#7f1d1d' // dark red
      });
  }

  // 2. Günlük Harcamalar
  if (standardDailySpentTotal > 0 && !isFuture) {
      pieData.push({
          name: 'Günlük Harcamalar',
          value: standardDailySpentTotal,
          color: '#ef4444' // red-500
      });
  }

  // 3. Yatırım / Birikim (Altın & Döviz Alımları)
  if (investmentSpentTotal > 0 && !isFuture) {
      pieData.push({
          name: 'Yatırım / Birikim',
          value: investmentSpentTotal,
          color: '#eab308' // yellow-500
      });
  }

  // 4. Sabit Giderler (Alphabetical)
  let colorIndex = 0;
  validFixedExpenses.forEach(expense => {
      pieData.push({
          name: expense.title,
          value: expense.amount,
          color: COLORS[colorIndex % COLORS.length]
      });
      colorIndex++;
  });

  const totalPieValue = pieData.reduce((sum, item) => sum + item.value, 0);

  // --- Premium donut yardımcıları ---
  // Merkez: toplam bütçe + "%X kalan" (açık varsa "%X açık" kırmızı).
  const centerTotalStr = `${Math.round(totalCashResources).toLocaleString('tr-TR')} ₺`;
  const remainPct = totalCashResources > 0 ? Math.round((trueRemaining / totalCashResources) * 100) : 0;
  const remainStr = trueRemaining >= 0 ? `%${remainPct} kalan` : `%${Math.abs(remainPct)} açık`;
  const remainColor = trueRemaining >= 0 ? '#22c55e' : '#ef4444';

  // Aktif dilim: dokunulan dilimin bilgisi merkezde gösterilir (uçan tooltip yok).
  const activeSlice = activeSliceIndex != null ? pieData[activeSliceIndex] : null;
  const activeSliceValueStr = activeSlice ? `${Math.round(activeSlice.value).toLocaleString('tr-TR')} ₺` : '';
  const activeSlicePct = activeSlice && totalPieValue > 0 ? ((activeSlice.value / totalPieValue) * 100).toFixed(1) : '0';

  // Aktif dilim büyütme (recharts activeShape). v3'te aktif durumu görünmez Tooltip sürüyor.
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={6} />
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center min-h-[40px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Bilanço</h1>
          <div className="flex items-center gap-1">
            {/* Masaustu: sag ustte arama. Mobil: arama profil menusunde (Ayarlar'in yaninda). */}
            <SearchTrigger className="hidden md:flex" />
            <PrivacyTrigger className="hidden md:flex" />
            {/* Mobilde profil menusu (avatar akordiyonu); masaustunde sol menude. */}
            <div className="md:hidden">
              <MobileProfileMenu />
            </div>
          </div>
        </div>

        <MonthNavigator />

        {isFuture && (
            <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs px-3 py-2 rounded-md border border-blue-500/20 text-center">
                Geçmiş veriler baz alınarak hesaplanan <strong>tahmini</strong> verilerdir.
            </div>
        )}
      </header>

      {/* Top Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <SwipeNavCard to="/islemler" beforeNavigate={() => sessionStorage.setItem('daily_draft_tab', JSON.stringify('NAKIT'))} icon={<span className="text-2xl font-bold">₺</span>} revealClassName="text-foreground">
        <Card title={isFuture ? "Tahmini Kalan Türk Lirası" : "Kalan Türk Lirası"} className="bg-gradient-to-br from-transparent to-secondary/20 h-full">

           <div className={`text-3xl font-bold mt-2 ${remainingCash < 0 ? 'text-red-500' : 'text-foreground'}`}>
             <Secret>{remainingCash.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam: <Secret>{totalCashResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
           </div>
           {isCurrentMonth && (
             <div className="text-xs text-muted-foreground mt-1">
               Kalan {daysLeftInMonth} gün · günde ~<span className={`font-semibold ${dailyAvgCash < 0 ? 'text-red-500' : 'text-foreground'}`}><Secret>{truncTo2(dailyAvgCash).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s|\u00A0/g, '')}</Secret></span>
             </div>
           )}
        </Card>
        </SwipeNavCard>

        {showMealCard && (
            <SwipeNavCard to="/islemler" beforeNavigate={() => sessionStorage.setItem('daily_draft_tab', JSON.stringify('YK'))} icon={<Utensils size={24} />} revealClassName="text-orange-600 dark:text-orange-500">
            <Card title="Kalan Yemek Kartı" className="bg-gradient-to-br from-transparent to-orange-500/15 border-orange-500/30 h-full">
            <div className="text-3xl font-bold text-orange-600 mt-2">
                <Secret>{finalRemainingYk.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
                Toplam: <Secret>{totalYkResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
            </div>
            {isCurrentMonth && (
              <div className="text-xs text-muted-foreground mt-1">
                Kalan {daysLeftInMonth} gün · günde ~<span className={`font-semibold ${dailyAvgYk < 0 ? 'text-red-500' : 'text-orange-600'}`}><Secret>{truncTo2(dailyAvgYk).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s|\u00A0/g, '')}</Secret></span>
              </div>
            )}
            </Card>
            </SwipeNavCard>
        )}

        <SwipeNavCard to="/borc" icon={<CreditCard size={24} />} revealClassName="text-red-500">
        <Card title={isFuture ? "Tahmini Kredi Kartı Ödemesi" : "Toplam Kredi Kartı Borcu"} className="bg-gradient-to-br from-transparent to-red-500/10 border-red-500/25 h-full">
           <div className="text-3xl font-bold text-red-500 mt-2">
             <Secret>{totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
           </div>
           {isFuture && <div className="text-xs text-muted-foreground mt-1">Bu ay ödenecek taksitler</div>}
        </Card>
        </SwipeNavCard>
      </div>

      {/* Altin emanetleri: bana gelen (kabul/ret) + benim gonderdiklerim (durum) */}
      {(incomingPending.length > 0 || sentGold.length > 0) && (
        <div className="space-y-3 mt-6">
          <h2 className="text-lg font-bold tracking-tight text-muted-foreground flex items-center gap-2">
            <Gift size={18} /> Altın Emanetleri
          </h2>

          {incomingPending.length > 0 && (
            <div className="rounded-xl glass border border-primary/30 p-4 space-y-3">
              <div className="text-sm font-semibold text-foreground">Size emanet edilen altınlar</div>
              {incomingPending.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="font-semibold"><Secret>{Number(r.amount).toLocaleString('tr-TR')} {getAssetSymbol(r.gold_type)}</Secret></span>
                    <span className="text-muted-foreground"> {getAssetFullTitle(r.gold_type)} — {r.creator_username} ekledi</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => acceptVaultRecord(r.id!)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/30 text-xs font-medium hover:bg-green-500/20 transition-colors">
                      <Check size={15} /> Kabul
                    </button>
                    <button onClick={() => rejectVaultRecord(r.id!)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 text-xs font-medium hover:bg-red-500/20 transition-colors">
                      <X size={15} /> Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sentGold.length > 0 && (
            <div className="rounded-xl glass p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">Emanet ettiğim altınlar</div>
              {sentGold.map(r => {
                const st = r.owner_status === 'accepted'
                  ? { label: 'Kabul etti — toplamınızda değil', cls: 'text-green-600 dark:text-green-500' }
                  : r.owner_status === 'rejected'
                  ? { label: 'Reddetti', cls: 'text-red-500' }
                  : { label: 'Onay bekliyor', cls: 'text-amber-600 dark:text-amber-500' };
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm flex-wrap">
                    <div>
                      <span className="font-semibold"><Secret>{Number(r.amount).toLocaleString('tr-TR')} {getAssetSymbol(r.gold_type)}</Secret></span>
                      <span className="text-muted-foreground"> {getAssetFullTitle(r.gold_type)} → {r.owner_username}</span>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Diğer Varlıklar */}
      {(vaultRecords.length > 0 || activeCurrencies.length > 0) && (
        <div className="space-y-3 mt-6">
          <div
            onClick={() => {
              const newVal = !isVaultExpanded;
              setIsVaultExpanded(newVal);
              localStorage.setItem('dashboard_vault_expanded', String(newVal));
            }}
            className="flex justify-between items-center cursor-pointer select-none group py-1"
          >
            <h2 className="text-lg font-bold tracking-tight text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-2">
              Döviz ve Kıymetli Madenler
            </h2>
            <div className="text-muted-foreground group-hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/50">
              {isVaultExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
          {isVaultExpanded && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {(() => {
              // Doviz kasa hareketleri motor tarafindan zaten dailyExpenses'e enjekte
              // edildigi icin (recalculate:396) burada ayrica kasa toplami eklenmez;
              // eklenince cift sayim olur.

              // Altin + doviz varlik tiplerini birlestir (gunluk-only dovizler dahil)
              const vaultAssetTypes = vaultRecords.map(r => r.gold_type);
              const uniqueAssetTypes = Array.from(new Set([...vaultAssetTypes, ...activeCurrencies]));

              // Her varligin GORUNEN birim degeri (altin: gram/adet, doviz: kalan tutar).
              // Hem siralamada hem render'da ayni deger kullanilir.
              const computeValue = (asset: string): { isGold: boolean; value: number } => {
                if (isGoldType(asset)) {
                  const groupRecords = vaultRecords.filter(r => r.gold_type === asset && (r.transaction_type || 'Birikim') !== 'Düğün Hediyesi / Takı');
                  const totalGold = groupRecords.reduce((sum, r) => {
                    const amt = Number(r.amount);
                    const tType = r.transaction_type || 'Birikim';
                    if (tType === 'Borç Verdim') return sum;
                    return tType === 'Birikim' ? sum + amt : sum - amt;
                  }, 0);
                  return { isGold: true, value: totalGold };
                }
                const assetBudget = state.assetBudgets?.[asset] || { income: 0, rollover: 0 };
                const customIncomeTotal = (state.customIncomes || [])
                  .filter(i => i.type === asset)
                  .reduce((sum, i) => sum + i.amount, 0);
                const dailyIncomeTotal = state.dailyExpenses
                  .filter(e => e.type === asset && e.amount > 0)
                  .reduce((sum, e) => sum + e.amount, 0);
                const totalResources = assetBudget.rollover + assetBudget.income + customIncomeTotal + dailyIncomeTotal;
                let totalSpent = 0;
                if (isFuture) {
                  totalSpent = state.fixedExpenses
                    .filter(e => e.type === asset)
                    .reduce((sum, e) => sum + e.amount, 0);
                } else {
                  const paidFixed = state.fixedExpenses
                    .filter(e => e.type === asset && e.isPaid)
                    .reduce((sum, e) => sum + e.amount, 0);
                  const dailySpent = state.dailyExpenses
                    .filter(e => e.type === asset && e.amount < 0)
                    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
                  totalSpent = paidFixed + dailySpent;
                }
                return { isGold: false, value: totalResources - totalSpent };
              };

              // Siralama: once altinlar, sonra dovizler; her grup birim sayisina gore
              // coktan aza; esit birim sayisinda ada gore A->Z.
              const enriched = uniqueAssetTypes
                .map(asset => ({ asset, ...computeValue(asset) }))
                .filter(a => a.value !== 0);

              enriched.sort((a, b) => {
                if (a.isGold !== b.isGold) return a.isGold ? -1 : 1;
                if (b.value !== a.value) return b.value - a.value;
                return getAssetFullTitle(a.asset).localeCompare(getAssetFullTitle(b.asset), 'tr');
              });

              return enriched.map(({ asset, isGold, value }) => {
                if (isGold) {
                  return (
                    <Card key={asset} title={getAssetFullTitle(asset)} className="bg-gradient-to-br from-transparent to-yellow-500/12 border-yellow-500/30">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">
                        <Secret>{value.toLocaleString('tr-TR')} {getAssetSymbol(asset)}</Secret>
                      </div>
                    </Card>
                  );
                }
                const colors = getCurrencyColors(asset);
                return (
                  <CurrencyAssetCard
                    key={asset}
                    fullTitle={getAssetFullTitle(asset)}
                    isoCode={getAssetIsoCode(asset)}
                    symbol={getAssetSymbol(asset)}
                    value={value}
                    colors={colors}
                  />
                );
              });
            })()}
            </div>
          )}
        </div>
      )}

      {/* Main Budget Summary & Chart */}
      <Card title={isFuture ? "Bütçe Planı" : "Aylık TL Bütçe Durumu"} className="space-y-6">

        {/* Progress Bar Section */}
        <div className={pieData.length > 0 ? "border-b border-border pb-6" : ""}>
            <div className="flex justify-between items-center text-sm mb-2">
               <span className="text-muted-foreground">{spendingLabel}: <Secret>{totalCashSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret></span>
               <span className="font-medium text-foreground">{(100 - usagePercentage).toFixed(1)}% Kalan</span>
            </div>
            <ProgressBar value={totalCashSpent} max={totalCashResources || 1} />
        </div>

        {/* Pie Chart Section */}
        {pieData.length > 0 && (
            <div className="mt-2">
                <div ref={chartRef} className={`relative w-full ${isMobile ? 'h-[300px]' : 'h-[320px]'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={isMobile ? 78 : 88}
                                outerRadius={isMobile ? 124 : 140}
                                paddingAngle={2}
                                cornerRadius={6}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                                stroke="none"
                                activeShape={renderActiveShape}
                                onMouseEnter={(_, i) => setActiveSliceIndex(i)}
                                onMouseLeave={() => setActiveSliceIndex(null)}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        fillOpacity={activeSliceIndex === null || activeSliceIndex === index ? 1 : 0.3}
                                    />
                                ))}
                            </Pie>
                            {/* Görünmez tooltip: yalnızca activeShape (dilim büyütme) tetiklensin diye; kutu çıkmaz */}
                            <Tooltip content={() => null} />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Donut merkezi: dilim aktifse o dilimin bilgisi, yoksa toplam bütçe */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex max-w-[150px] flex-col items-center text-center">
                            {activeSlice ? (
                                <>
                                    <span className="text-xs leading-snug" style={{ color: activeSlice.color }}>{activeSlice.name}</span>
                                    <span className="mt-1 text-xl font-semibold leading-tight text-foreground"><Secret>{activeSliceValueStr}</Secret></span>
                                    <span className="text-sm font-semibold leading-tight" style={{ color: activeSlice.color }}>%{activeSlicePct}</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-xs leading-tight text-muted-foreground">Toplam Bütçe</span>
                                    <span className="text-xl font-semibold leading-tight text-foreground"><Secret>{centerTotalStr}</Secret></span>
                                    <span className="text-sm font-semibold leading-tight" style={{ color: remainColor }}>{remainStr}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {/* Legend: HTML, pieData sirasiyla (Kalan, Gunluk, Yatirim, sonra sabit giderler) */}
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
                    {pieData.map((entry, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: entry.color }} />
                            {entry.name}
                        </span>
                    ))}
                </div>
            </div>
        )}
      </Card>
    </div>
  );
}
