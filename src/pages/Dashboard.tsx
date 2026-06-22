import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Sun, Moon, ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

const isGoldType = (type: string) => {
  const lower = type.toLowerCase();
  const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
  return goldKeywords.some(kw => lower.includes(kw));
};

export default function Dashboard() {
  const { state, viewDate, earliestAllowedMonth, setViewDate, theme, toggleTheme, showMealCard, vaultRecords, vaultOrder, activeCurrencies } = useBudget();
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


  // Helper to format month
  const formatMonth = (dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  // Helper to change month
  const changeMonth = (delta: number) => {
    let [y, m] = viewDate.split('-').map(Number);
    m += delta;
    while (m > 12) {
      m -= 12;
      y++;
    }
    while (m < 1) {
      m += 12;
      y--;
    }
    const newStr = `${y}-${String(m).padStart(2, '0')}`;
    setViewDate(newStr);
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
      const totalFixed = state.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
      totalCashSpent = totalFixed;
      // No daily expenses in future
      spendingLabel = "Planlanan Gider";
  } else {
      // Normal Mode
      const paidFixed = state.fixedExpenses
        .filter(e => e.isPaid)
        .reduce((sum, e) => sum + e.amount, 0);

      const cashSpent = state.dailyExpenses
        .filter(e => e.amount < 0 && e.type === 'NAKIT')
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

      totalCashSpent = paidFixed + cashSpent;
  }

  const remainingCash = totalCashResources - totalCashSpent;

  // CC Debt
  // In future, CC Debts list contains "Projected Installments".
  // We sum them up.
  const totalCCDebt = Math.abs(state.ccDebts.reduce((sum, d) => sum + d.amount, 0));
  
  // Progress Bar
  // If future, usage = fixed expenses / income
  const usagePercentage = totalCashResources > 0 ? (totalCashSpent / totalCashResources) * 100 : 0;

  return (
    <div className="space-y-6 pb-20 p-4">
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Bilanço</h1>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link to="/settings" className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors">
              <SettingsIcon size={20} />
            </Link>
          </div>
        </div>

        <div className="flex justify-between items-center bg-secondary/30 rounded-xl p-2">
           <button
             onClick={() => changeMonth(-1)}
             disabled={viewDate <= earliestAllowedMonth}
             className={`p-2 rounded-lg transition-colors ${viewDate <= earliestAllowedMonth ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'hover:bg-secondary'}`}
           >
               <ChevronLeft size={20} />
           </button>

           <div className="flex flex-col items-center">
               <div className="flex items-center gap-2 font-medium text-lg">
                   <Calendar size={18} className="text-primary" />
                   <span className="capitalize w-32 text-center">{formatMonth(viewDate)}</span>
               </div>
           </div>

           <button onClick={() => changeMonth(1)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
               <ChevronRight size={20} />
           </button>
        </div>

        {isFuture && (
            <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs px-3 py-2 rounded-md border border-blue-500/20 text-center">
                Geçmiş veriler baz alınarak hesaplanan <strong>tahmini</strong> verilerdir.
            </div>
        )}
      </header>

      {/* Top Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card title={isFuture ? "Tahmini Kalan Türk Lirası" : "Kalan Türk Lirası"} className="bg-gradient-to-br from-card to-secondary/10">

           <div className={`text-3xl font-bold mt-2 ${remainingCash < 0 ? 'text-red-500' : 'text-foreground'}`}>
             {remainingCash.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam: {totalCashResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        {showMealCard && (
            <Card title="Kalan Yemek Kartı" className="bg-gradient-to-br from-card to-orange-500/5 border-orange-500/20">
            <div className="text-3xl font-bold text-orange-600 mt-2">
                {finalRemainingYk.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
                Toplam: {totalYkResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </div>
            </Card>
        )}

        <Card title={isFuture ? "Tahmini Kredi Kartı Ödemesi" : "Toplam Kredi Kartı Borcu"} className="border-red-900/20 bg-red-950/5">
           <div className="text-3xl font-bold text-red-500 mt-2">
             {totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
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
              const addMonths = (dateStr: string, months: number): string => {
                let [y, m] = dateStr.split('-').map(Number);
                m += months;
                while (m > 12) {
                  m -= 12;
                  y++;
                }
                while (m < 1) {
                  m += 12;
                  y--;
                }
                return `${y}-${String(m).padStart(2, '0')}`;
              };

              const getKasaSum = (records: any[], type: string, filterFn: (date: string) => boolean) => {
                return records
                  .filter(r => r.gold_type === type && filterFn(r.record_date))
                  .reduce((sum, r) => {
                    const amt = Number(r.amount);
                    const tType = r.transaction_type || 'Birikim';
                    if (tType === 'Borç Verdim') return sum;
                    if (tType === 'Birikim' || tType === 'Giriş' || tType === 'Bütçe Geliri') {
                      return sum + amt;
                    } else {
                      return sum - amt;
                    }
                  }, 0);
              };

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
                    <Card key={asset} title={getAssetFullTitle(asset)} className="bg-yellow-500/5 border-yellow-500/20">
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

                  const kasaChanges = getKasaSum(vaultRecords, asset, d => d >= `${state.currentMonth}-01` && d < `${addMonths(state.currentMonth, 1)}-01`);
                  const finalResources = totalResources + (kasaChanges > 0 ? kasaChanges : 0);
                  const finalSpent = totalSpent + (kasaChanges < 0 ? Math.abs(kasaChanges) : 0);
                  const remaining = finalResources - finalSpent;

                  if (remaining === 0) return null;

                  return (
                    <Card key={asset} title={getAssetFullTitle(asset)} className="bg-emerald-500/5 border-emerald-500/20">
                      <div className={`text-2xl font-bold mt-2 ${remaining < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {remaining.toLocaleString('tr-TR')} {getAssetSymbol(asset)}
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

      {/* Main Budget Progress */}
      <Card title={isFuture ? "Bütçe Planı" : "Aylık TL Bütçe Durumu"} className="space-y-4">

        <div className="flex justify-between items-center text-sm mb-1">
           <span className="text-muted-foreground">{spendingLabel}: {totalCashSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
           <span className="font-medium text-foreground">{(100 - usagePercentage).toFixed(1)}% Kalan</span>
        </div>
        <ProgressBar value={totalCashSpent} max={totalCashResources || 1} />
      </Card>
    </div>
  );
}
