import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CheckCircle, Circle, Pencil, X, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FixedExpense } from '../types';

export default function FixedExpenses() {
  const {
    state,
    viewDate,
    addFixedExpense,
    updateFixedExpense,
    toggleFixedExpense,
    deleteFixedExpense,
    updateIncome,
    updateRollover,
    updateYkIncome,
    updateYkRollover
  } = useBudget();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Local state for inputs
  const [income, setIncome] = useState(state.income.toString());
  const [rollover, setRollover] = useState(state.rollover.toFixed(2));
  const [ykIncome, setYkIncome] = useState((state.ykIncome || 0).toString());
  const [ykRollover, setYkRollover] = useState((state.ykRollover || 0).toFixed(2));

  // Sync when state changes (e.g. viewDate change or external update)
  useEffect(() => {
    setIncome(state.income.toString());
    // Format rollovers to max 2 decimals to prevent long floating point numbers
    setRollover(Number(state.rollover).toFixed(2));
    setYkIncome((state.ykIncome || 0).toString());
    setYkRollover(Number(state.ykRollover || 0).toFixed(2));
  }, [state.income, state.rollover, state.ykIncome, state.ykRollover, viewDate]);

  const handleIncomeSave = () => {
    updateIncome(parseFloat(income) || 0);
  };

  const handleRolloverSave = () => {
    updateRollover(parseFloat(rollover) || 0);
  };

  const handleYkIncomeSave = () => {
    updateYkIncome(parseFloat(ykIncome) || 0);
  };

  const handleYkRolloverSave = () => {
    updateYkRollover(parseFloat(ykRollover) || 0);
  };

  const handleEdit = (expense: FixedExpense) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(expense.amount.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    if (editingId) {
      updateFixedExpense(editingId, {
        title,
        amount: parseFloat(amount)
      });
      setEditingId(null);
    } else {
      addFixedExpense({ title, amount: parseFloat(amount) });
    }

    setTitle('');
    setAmount('');
  };

  const isFuture = viewDate > new Date().toISOString().slice(0, 7);
  const formattedMonth = new Date(
      parseInt(viewDate.split('-')[0]),
      parseInt(viewDate.split('-')[1]) - 1
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const totalFixed = state.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paidFixed = state.fixedExpenses.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 pb-20 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Sabit Gelirler</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span className="capitalize">{formattedMonth}</span>
            {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded ml-2">Planlama Modu</span>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Aylık Gelir (Nakit)">
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

        <Card title="Devreden (Nakit)">
          <div className="mt-2">
             <input
               type="number"
               value={rollover}
               onChange={(e) => setRollover(e.target.value)}
               onBlur={handleRolloverSave}
               disabled={isFuture}
               className={cn(
                 "w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                 isFuture && "opacity-50 cursor-not-allowed bg-secondary/30"
               )}
             />
             {isFuture && <div className="text-xs text-muted-foreground mt-1">Önceki aydan tahmini devir</div>}
          </div>
        </Card>

        <Card title="Yemek Kartı Geliri">
          <div className="mt-2">
             <input
               type="number"
               value={ykIncome}
               onChange={(e) => setYkIncome(e.target.value)}
               onBlur={handleYkIncomeSave}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>
        </Card>

        <Card title="Yemek Kartı Devreden">
          <div className="mt-2">
             <input
               type="number"
               value={ykRollover}
               onChange={(e) => setYkRollover(e.target.value)}
               onBlur={handleYkRolloverSave}
               disabled={isFuture}
               className={cn(
                 "w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                 isFuture && "opacity-50 cursor-not-allowed bg-secondary/30"
               )}
             />
             {isFuture && <div className="text-xs text-muted-foreground mt-1">Önceki aydan tahmini devir</div>}
          </div>
        </Card>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mt-8">Sabit Giderler</h1>

      <Card title="Gider Özeti" className="bg-gradient-to-br from-card to-primary/5">
        <div className="flex flex-col gap-2 mt-2 sm:flex-row sm:justify-between sm:items-end sm:gap-0">
          <div>
            <div className="text-sm text-muted-foreground">Toplam</div>
            <div className="text-2xl font-bold whitespace-nowrap">{totalFixed.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Ödenen</div>
            <div className="text-xl font-bold text-green-500 whitespace-nowrap">{paidFixed.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full">
        <input
          type="text"
          placeholder="Gider Adı (örn: Kira)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full sm:flex-[2] min-w-0 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="number"
            placeholder="Tutar"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 sm:flex-none sm:w-28 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {editingId && (
             <button
               type="button"
               onClick={cancelEdit}
               className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80"
             >
               <X size={24} />
             </button>
          )}

          <button
            type="submit"
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {editingId ? <Pencil size={24} /> : <Plus size={24} />}
          </button>
        </div>
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
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              {expense.isPaid ? (
                <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
              ) : (
                <Circle className="text-muted-foreground flex-shrink-0" size={24} />
              )}
              <div className="text-left min-w-0 flex-1">
                <div className={cn("font-medium truncate", expense.isPaid && "line-through")}>{expense.title}</div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {expense.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </div>
              </div>
            </button>
            
            <div className="flex items-center">
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(expense); }}
                className="p-2 text-primary hover:text-primary/80 transition-colors"
              >
                <Pencil size={20} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteFixedExpense(expense.id); }}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
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
