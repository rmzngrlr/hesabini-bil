import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, ChevronDown, Sun, Moon } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';
import type { BudgetState } from '../types';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard() {
  const { state, theme, toggleTheme } = useBudget();

  // Month Selection State
  // Default to 'current' which represents live state.
  // Other values will be 'YYYY-MM' strings from history.
  const [selectedMonth, setSelectedMonth] = useState<string>('current');

  // Determine which data to show
  let displayState: BudgetState;

  if (selectedMonth === 'current') {
    displayState = state;
  } else {
    // Find history entry
    const historyEntry = state.history.find(h => h.month === selectedMonth);
    if (historyEntry) {
      // Construct a partial BudgetState for display purposes
      // Warning: history entry doesn't have 'version', 'currentMonth', 'history', 'installments' usually
      // We need to cast or mock them.
      displayState = {
        ...state, // fallback for missing props
        ...historyEntry,
        // Override arrays from history
        fixedExpenses: historyEntry.fixedExpenses,
        dailyExpenses: historyEntry.dailyExpenses,
        ccDebts: historyEntry.ccDebts,
      };
    } else {
      displayState = state; // Fallback
    }
  }

  // Available months for dropdown
  // Unique months from history + current month
  // state.history is array of { month: 'YYYY-MM', ... }
  // We need to sort them.
  const historyMonths = state.history.map(h => h.month).sort().reverse();
  // Ensure current month is top
  // If history is empty, just current.

  const currentMonthLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  // Calculations based on displayState

  // YK Resources
  const ykIncome = displayState.ykIncome || 0;
  const ykRollover = displayState.ykRollover || 0;
  const totalYkResources = ykIncome + ykRollover;

  const ykSpent = displayState.dailyExpenses
    .filter(e => e.type === 'YK' && e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Cash Resources
  const dailyCashIncome = displayState.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'NAKIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const dailyYkIncome = displayState.dailyExpenses
    .filter(e => e.amount > 0 && e.type === 'YK')
    .reduce((sum, e) => sum + e.amount, 0);

  // Update YK Resources with Daily YK Income
  const finalYkResources = totalYkResources + dailyYkIncome;
  const finalRemainingYk = finalYkResources - ykSpent;

  // Cash Resources
  const totalCashResources = displayState.income + displayState.rollover + dailyCashIncome;

  const paidFixedExpenses = displayState.fixedExpenses
    .filter(e => e.isPaid)
    .reduce((sum, e) => sum + e.amount, 0);

  const cashSpent = displayState.dailyExpenses
    .filter(e => e.amount < 0 && e.type === 'NAKIT')
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const totalCashSpent = paidFixedExpenses + cashSpent;
  const remainingCash = totalCashResources - totalCashSpent;

  const totalCCDebt = displayState.ccDebts.reduce((sum, d) => sum + d.amount, 0);

  const spendingPercentage = totalCashResources > 0 ? (totalCashSpent / totalCashResources) * 100 : 0;
  
  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Özet Paneli</h1>

          <div className="relative inline-block text-left mt-1">
             <select
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(e.target.value)}
               className="appearance-none bg-transparent text-sm text-muted-foreground font-medium capitalize pr-6 focus:outline-none cursor-pointer"
             >
               <option value="current">{currentMonthLabel} (Güncel)</option>
               {historyMonths.map(month => (
                 <option key={month} value={month}>
                   {new Date(month + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                 </option>
               ))}
             </select>
             <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
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
      </header>

      {/* Top Summary Cards */}
      <div className="grid gap-4 grid-cols-1">
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
