import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2 } from 'lucide-react';

export default function Debt() {
  const { state, addCCDebt, deleteCCDebt } = useBudget();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    addCCDebt({ description, amount: parseFloat(amount) });
    setDescription('');
    setAmount('');
  };

  const totalDebt = state.ccDebts.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Kredi Kartı Borçları</h1>
      </header>

      <Card title="Toplam Borç" className="bg-red-950/20 border-red-900/20">
        <div className="text-3xl font-bold text-red-500 mt-2">
          {totalDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Borç Kalemi"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
        {state.ccDebts.map((debt) => (
          <div key={debt.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
            <div className="font-medium">{debt.description}</div>
            <div className="flex items-center gap-4">
              <div className="font-bold text-red-400">
                {debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
              </div>
              <button
                onClick={() => deleteCCDebt(debt.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
         {state.ccDebts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Borç kaydı bulunmamaktadır.
          </div>
        )}
      </div>
    </div>
  );
}
