import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Sun, Moon, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard() {
  const { state, viewDate, earliestAllowedMonth, setViewDate, theme, toggleTheme, showMealCard, vaultRecords, vaultOrder } = useBudget();

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
          <h1 className="text-2xl font-bold tracking-tight">Hesabını Bil!</h1>
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
        <Card title={isFuture ? "Tahmini Kalan Nakit" : "Kalan Nakit"} className="bg-gradient-to-br from-card to-secondary/10">
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

      {/* Kasa ve Birikim Varlıkları */}
      {vaultRecords.length > 0 && (
        <div className="space-y-3 mt-6">
          <h2 className="text-lg font-bold tracking-tight text-muted-foreground">Kasa & Varlık Hesapları</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {(() => {
              const isGoldType = (type: string) => {
                const lower = type.toLowerCase();
                const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
                return goldKeywords.some(kw => lower.includes(kw));
              };

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
                    if (tType === 'Birikim' || tType === 'Giriş' || tType === 'Bütçe Geliri') {
                      return sum + amt;
                    } else {
                      return sum - amt;
                    }
                  }, 0);
              };

              const uniqueAssetTypes = Array.from(new Set(vaultRecords.map(r => r.gold_type)));
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
                    return (r.transaction_type || 'Birikim') === 'Birikim' ? sum + amt : sum - amt;
                  }, 0);

                  if (totalGold === 0) return null;

                  return (
                    <Card key={asset} title={asset} className="bg-yellow-500/5 border-yellow-500/20">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">
                        {totalGold} {asset}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Fiziksel Birikim</div>
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
                    <Card key={asset} title={asset} className="bg-emerald-500/5 border-emerald-500/20">
                      <div className={`text-2xl font-bold mt-2 ${remaining < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                        {remaining.toLocaleString('tr-TR')} {asset}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Kalan (Kasa + Bütçe)
                      </div>
                    </Card>
                  );
                }
              });
            })()}
          </div>
        </div>
      )}

      {/* Main Budget Progress */}
      <Card title={isFuture ? "Bütçe Planı" : "Aylık Nakit Bütçe Durumu"} className="space-y-4">
        <div className="flex justify-between items-center text-sm mb-1">
           <span className="text-muted-foreground">{spendingLabel}: {totalCashSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
           <span className="font-medium text-foreground">{(100 - usagePercentage).toFixed(1)}% Kalan</span>
        </div>
        <ProgressBar value={totalCashSpent} max={totalCashResources || 1} />
      </Card>
    </div>
  );
}
