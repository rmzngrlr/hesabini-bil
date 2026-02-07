import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function FixedExpenses() {
  const { state, addFixedExpense, toggleFixedExpense, deleteFixedExpense, updateIncome, updateRollover } = useBudget();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  const [income, setIncome] = useState(state.income.toString());
  const [rollover, setRollover] = useState(state.rollover.toString());

  useEffect(() => {
    if (state.income.toString() !== income) {
      setIncome(state.income.toString());
    }
    if (state.rollover.toString() !== rollover) {
      setRollover(state.rollover.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.income, state.rollover]);

  const handleIncomeSave = () => {
    updateIncome(parseFloat(income) || 0);
  };

  const handleRolloverSave = () => {
    updateRollover(parseFloat(rollover) || 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;
    addFixedExpense({ title, amount: parseFloat(amount) });
    setTitle('');
    setAmount('');
  };

  const totalFixed = state.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidFixed = state.fixedExpenses.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Sabit Giderler</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Aylık Gelir">
          <div className="mt-2">
            <input
              type="number"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              onBlur={handleIncomeSave}
              className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </Card>

        <Card title="Geçen Aydan Devreden">
          <div className="mt-2">
             <input
               type="number"
               value={rollover}
               onChange={(e) => setRollover(e.target.value)}
               onBlur={handleRolloverSave}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>
        </Card>
      </div>

      <Card title="Gider Özeti" className="bg-gradient-to-br from-card to-primary/5">
        <div className="flex justify-between items-end mt-2">
          <div>
            <div className="text-sm text-muted-foreground">Toplam</div>
            <div className="text-2xl font-bold">{totalFixed.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Ödenen</div>
            <div className="text-xl font-bold text-green-500">{paidFixed.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Gider Adı (örn: Kira)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="number"
          placeholder="Tutar"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={24} />
        </button>
      </form>

      <div className="space-y-3">
        {state.fixedExpenses.map((expense) => (
          <div
            key={expense.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border border-border bg-card transition-all",
              expense.isPaid && "opacity-60 bg-secondary/50"
            )}
          >
            <button
              onClick={() => toggleFixedExpense(expense.id)}
              className="flex items-center gap-3 flex-1"
            >
              {expense.isPaid ? (
                <CheckCircle className="text-green-500" size={24} />
              ) : (
                <Circle className="text-muted-foreground" size={24} />
              )}
              <div className="text-left">
                <div className={cn("font-medium", expense.isPaid && "line-through")}>{expense.title}</div>
                <div className="text-sm text-muted-foreground">
                  {expense.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </div>
              </div>
            </button>
            
            <button
              onClick={() => deleteFixedExpense(expense.id)}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
        {state.fixedExpenses.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Henüz sabit gider eklenmemiş.
          </div>
        )}
      </div>
    </div>
  );
}
