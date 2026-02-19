import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Sun, Moon, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard() {
  const { state, viewDate, setViewDate, theme, toggleTheme } = useBudget();

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

  const totalCashResources = state.income + state.rollover + dailyCashIncome;

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

  const isFuture = viewDate > new Date().toISOString().slice(0, 7);

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
           <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
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

        <Card title="Kalan Yemek Kartı" className="bg-gradient-to-br from-card to-orange-500/5 border-orange-500/20">
           <div className="text-3xl font-bold text-orange-600 mt-2">
             {finalRemainingYk.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam: {totalYkResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        <Card title={isFuture ? "Tahmini Kredi Kartı Ödemesi" : "Toplam Kredi Kartı Borcu"} className="border-red-900/20 bg-red-950/5">
           <div className="text-3xl font-bold text-red-500 mt-2">
             {totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           {isFuture && <div className="text-xs text-muted-foreground mt-1">Bu ay ödenecek taksitler</div>}
        </Card>
      </div>

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
