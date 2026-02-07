import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard() {
  const { state } = useBudget();

  // Calculations

  // YK Resources
  const ykIncome = state.ykIncome || 0;
  const ykRollover = state.ykRollover || 0;
  const totalYkResources = ykIncome + ykRollover;

  const ykSpent = state.dailyExpenses
    .filter(e => e.type === 'YK' && e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Cash Resources
  // Assuming Daily Income is always Cash? The form defaults to 'NAKIT' for type when adding, but checks should be precise.
  // Actually, 'addDailyExpense' takes 'type' which can be 'NAKIT' or 'YK'.
  // If user adds 'Gelir' (Positive amount) with type 'YK', it should technically add to YK resources?
  // The current UI defaults to 'NAKIT' for Income if user doesn't toggle.
  // Let's refine:
  // Income entries in dailyExpenses:
  const dailyCashIncome = state.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'NAKIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const dailyYkIncome = state.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'YK')
    .reduce((sum, e) => sum + e.amount, 0);

  // Update YK Resources with Daily YK Income
  const finalYkResources = totalYkResources + dailyYkIncome;
  const finalRemainingYk = finalYkResources - ykSpent;

  // Cash Resources
  const totalCashResources = state.income + state.rollover + dailyCashIncome;

  const paidFixedExpenses = state.fixedExpenses
    .filter(e => e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  const cashSpent = state.dailyExpenses
    .filter(e => e.amount < 0 && e.type === 'NAKIT')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Total Cash Spent = Fixed Expenses + Daily Cash Expenses
  const totalCashSpent = paidFixedExpenses + cashSpent;
  const remainingCash = totalCashResources - totalCashSpent;

  const totalCCDebt = state.ccDebts.reduce((sum, d) => sum + d.amount, 0);

  // Spending percentage (Cash only for main progress bar?)
  // Or Combined? Let's show Cash primarily as "Bütçe" usually refers to main money.
  const spendingPercentage = totalCashResources > 0 ? (totalCashSpent / totalCashResources) * 100 : 0;
  
  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Özet Paneli</h1>
          <div className="text-sm text-muted-foreground capitalize">
            {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </div>
        </div>
        <Link to="/settings" className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors">
          <SettingsIcon size={20} />
        </Link>
      </header>

      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Kalan Nakit" className="bg-gradient-to-br from-card to-secondary/10">
           <div className="text-3xl font-bold text-foreground mt-2">
             {remainingCash.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam Nakit: {totalCashResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        <Card title="Kalan Yemek Kartı" className="bg-gradient-to-br from-card to-orange-500/5 border-orange-500/20">
           <div className="text-3xl font-bold text-orange-600 mt-2">
             {finalRemainingYk.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam YK: {finalYkResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>

        <Card title="Toplam Kredi Kartı Borcu" className="border-red-900/20 bg-red-950/5">
           <div className="text-3xl font-bold text-red-500 mt-2">
             {totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>
      </div>

      {/* Main Budget Progress */}
      <Card title="Aylık Nakit Bütçe Durumu" className="space-y-4">
        <div className="flex justify-between items-center text-sm mb-1">
           <span className="text-muted-foreground">Harcama: {totalCashSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
           <span className="font-medium text-foreground">{(100 - spendingPercentage).toFixed(1)}% Kalan</span>
        </div>
        <ProgressBar value={totalCashSpent} max={totalCashResources || 1} />
      </Card>
    </div>
  );
}
