import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard() {
  const { state } = useBudget();

  // Calculations
  const dailyIncome = state.dailyExpenses
    .filter(e => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  const dailyOutcome = state.dailyExpenses
    .filter(e => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const totalAvailableResources = state.income + state.rollover + dailyIncome;
  
  const paidFixedExpenses = state.fixedExpenses
    .filter(e => e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalSpent = paidFixedExpenses + dailyOutcome;
  const remainingAllowance = totalAvailableResources - totalSpent;

  const totalCCDebt = state.ccDebts.reduce((sum, d) => sum + d.amount, 0);

  // Spending percentage
  const spendingPercentage = totalAvailableResources > 0 ? (totalSpent / totalAvailableResources) * 100 : 0;
  
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Kalan Harçlık" className="bg-gradient-to-br from-card to-secondary/10">
           <div className="text-3xl font-bold text-foreground mt-2">
             {remainingAllowance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
           <div className="text-xs text-muted-foreground mt-1">
             Toplam Kaynak: {totalAvailableResources.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>
        
        <Card title="Toplam Kredi Kartı Borcu" className="border-red-900/20 bg-red-950/5">
           <div className="text-3xl font-bold text-red-500 mt-2">
             {totalCCDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
           </div>
        </Card>
      </div>

      {/* Main Budget Progress */}
      <Card title="Aylık Bütçe Durumu" className="space-y-4">
        <div className="flex justify-between items-center text-sm mb-1">
           <span className="text-muted-foreground">Harcama: {totalSpent.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
           <span className="font-medium text-foreground">{(100 - spendingPercentage).toFixed(1)}% Kalan</span>
        </div>
        <ProgressBar value={totalSpent} max={totalAvailableResources || 1} />
      </Card>
    </div>
  );
}
