import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MobileProfileMenu } from '../components/MobileProfileMenu';
import { MonthNavigator } from '../components/MonthNavigator';
import { useBudget } from '../context/BudgetContext';
import { isDebtPending } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ProgressBar } from '../components/ui/ProgressBar';

const isGoldType = (type: string) => {
  const lower = type.toLowerCase();
  const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
  return goldKeywords.some(kw => lower.includes(kw));
};

export default function Dashboard() {
  const { state, viewDate, showMealCard, vaultRecords, vaultOrder, activeCurrencies, todayStr } = useBudget();

  // Track window size for responsive chart rendering
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  const COLORS = ['#FFBB28', '#FF8042', '#8884D8', '#A28DFF', '#FF6666', '#0088FE', '#00C49F'];

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

  return (
    <div className="space-y-6 pb-20 p-4">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Bilanço</h1>
          {/* Mobilde profil menusu (avatar akordiyonu); masaustunde sol menude. */}
          <div className="md:hidden">
            <MobileProfileMenu />
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
        <Card title={isFuture ? "Tahmini Kalan Türk Lirası" : "Kalan Türk Lirası"} className="bg-gradient-to-br from-transparent to-secondary/20">

           <div className={`text-3xl font-bold mt-2 ${remainingCash < 0 ? 'text-red-500' : 'text-foreground'}`}>
             {remainingCash.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam: {totalCashResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
           </div>
           {isCurrentMonth && (
             <div className="text-xs text-muted-foreground mt-1">
               Kalan {daysLeftInMonth} gün · günde ~<span className={`font-semibold ${dailyAvgCash < 0 ? 'text-red-500' : 'text-foreground'}`}>{truncTo2(dailyAvgCash).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s|\u00A0/g, '')}</span>
             </div>
           )}
        </Card>

        {showMealCard && (
            <Card title="Kalan Yemek Kartı" className="bg-gradient-to-br from-transparent to-orange-500/15 border-orange-500/30">
            <div className="text-3xl font-bold text-orange-600 mt-2">
                {finalRemainingYk.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
                Toplam: {totalYkResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
            </div>
            {isCurrentMonth && (
              <div className="text-xs text-muted-foreground mt-1">
                Kalan {daysLeftInMonth} gün · günde ~<span className={`font-semibold ${dailyAvgYk < 0 ? 'text-red-500' : 'text-orange-600'}`}>{truncTo2(dailyAvgYk).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s|\u00A0/g, '')}</span>
              </div>
            )}
            </Card>
        )}

        <Card title={isFuture ? "Tahmini Kredi Kartı Ödemesi" : "Toplam Kredi Kartı Borcu"} className="bg-gradient-to-br from-transparent to-red-500/10 border-red-500/25">
           <div className="text-3xl font-bold text-red-500 mt-2">
             {totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
           </div>
           {isFuture && <div className="text-xs text-muted-foreground mt-1">Bu ay ödenecek taksitler</div>}
        </Card>
      </div>

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
              Diğer Varlıklar
            </h2>
            <div className="text-muted-foreground group-hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/50">
              {isVaultExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
          {isVaultExpanded && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {(() => {
              // NOT: addMonths ve getKasaSum yardimcilari kaldirildi. Doviz kasa
              // hareketleri motor tarafindan zaten dailyExpenses'e enjekte edildigi
              // icin (recalculate:396) burada ayrica kasa toplami hesaplanmiyordu;
              // ekleyince cift sayim oluyordu.

              // Merge vault asset types (gold + foreign currency) with daily-only currencies
              const vaultAssetTypes = vaultRecords.map(r => r.gold_type);
              const uniqueAssetTypes = Array.from(new Set([...vaultAssetTypes, ...activeCurrencies]));
              const sortedAssetTypes = uniqueAssetTypes.sort((a, b) => {
                const idxA = vaultOrder?.indexOf(a) ?? -1;
                const idxB = vaultOrder?.indexOf(b) ?? -1;
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
              });

              return sortedAssetTypes.map(asset => {
                const isGold = isGoldType(asset);
                
                if (isGold) {
                  const groupRecords = vaultRecords.filter(r => r.gold_type === asset && (r.transaction_type || 'Birikim') !== 'Düğün Hediyesi / Takı');
                  const totalGold = groupRecords.reduce((sum, r) => {
                    const amt = Number(r.amount);
                    const tType = r.transaction_type || 'Birikim';
                    if (tType === 'Borç Verdim') return sum;
                    return tType === 'Birikim' ? sum + amt : sum - amt;
                  }, 0);

                  if (totalGold === 0) return null;

                  return (
                    <Card key={asset} title={getAssetFullTitle(asset)} className="bg-gradient-to-br from-transparent to-yellow-500/12 border-yellow-500/30">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">
                        {totalGold} {getAssetSymbol(asset)}
                      </div>
                    </Card>
                  );
                } else {
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

                  // Döviz kasa hareketleri MOTOR TARAFINDAN zaten dailyExpenses'e
                  // 'vault-curr-' kayitlari olarak enjekte ediliyor (recalculate:396) ve
                  // yukarida dailyIncomeTotal/dailySpent icinde sayiliyor. Burada ayrica
                  // getKasaSum ile eklemek ayni tutari IKI KEZ sayiyordu (50+75+75=200).
                  // Ay devri motoru da geçmis aylar icin kasaChanges=0 kullaniyor (:502);
                  // burada da ayni davraniyoruz.
                  const remaining = totalResources - totalSpent;

                  if (remaining === 0) return null;

                  return (
                    <Card key={asset} title={getAssetFullTitle(asset)} className="bg-gradient-to-br from-transparent to-emerald-500/12 border-emerald-500/30">
                      <div className={`text-2xl font-bold mt-2 ${remaining < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {remaining.toLocaleString('tr-TR')}{isGoldType(asset) ? ' ' : ''}{getAssetSymbol(asset)}
                      </div>
                    </Card>
                  );
                }
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
               <span className="text-muted-foreground">{spendingLabel}: {totalCashSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</span>
               <span className="font-medium text-foreground">{(100 - usagePercentage).toFixed(1)}% Kalan</span>
            </div>
            <ProgressBar value={totalCashSpent} max={totalCashResources || 1} />
        </div>

        {/* Pie Chart Section */}
        {pieData.length > 0 && (
            <div className={`w-full mt-2 ${isMobile ? 'h-[340px]' : 'h-64'}`}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy={isMobile ? "45%" : "50%"}
                            innerRadius={0}
                            outerRadius={isMobile ? 100 : 110}
                            paddingAngle={0}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, name) => {
                                const percent = totalPieValue > 0 ? ((Number(value) / totalPieValue) * 100).toFixed(1) : 0;
                                return [`${Number(value).toLocaleString('tr-TR')} ₺ (%${percent})`, name];
                            }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                        <Legend
                            content={(props) => {
                                const { payload } = props;
                                if (!payload) return null;

                                // We want to force the exact order of pieData:
                                // Kalan TL, Günlük Harcamalar, then Sabit Giderler.
                                // Recharts provides the payload, we just re-order it based on pieData.
                                const sortedPayload = [...payload].sort((a, b) => {
                                    const indexA = pieData.findIndex(item => item.name === a.value);
                                    const indexB = pieData.findIndex(item => item.name === b.value);
                                    return indexA - indexB;
                                });

                                return (
                                    <ul className="recharts-default-legend" style={{ padding: '0px', margin: '0px', textAlign: 'center' }}>
                                        {sortedPayload.map((entry, index) => (
                                            <li key={`item-${index}`} className={`recharts-legend-item legend-item-${index}`} style={{ display: 'inline-block', marginRight: '10px' }}>
                                                <svg className="recharts-surface" width="14" height="14" viewBox="0 0 32 32" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                                    <path fill={entry.color} cx="16" cy="16" type="square" className="recharts-legend-icon" d="M0,0h32v32h-32z"></path>
                                                </svg>
                                                <span className="recharts-legend-item-text" style={{ color: entry.color }}>{entry.value}</span>
                                            </li>
                                        ))}
                                    </ul>
                                );
                            }}
                            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )}
      </Card>
    </div>
  );
}
