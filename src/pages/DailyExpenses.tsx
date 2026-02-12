import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { DailyExpense } from '../types';
import { Card } from '../components/ui/Card';
import { Trash2, Banknote, Wallet, CreditCard, Pencil, X } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function DailyExpenses() {
  const { state, addDailyExpense, updateDailyExpense, deleteDailyExpense } = useBudget();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'NAKIT' | 'YK'>('NAKIT');
  const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [activeTab, setActiveTab] = useState<'NAKIT' | 'YK'>('NAKIT');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (expense: DailyExpense) => {
    setEditingId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setAmount(Math.abs(expense.amount).toString());
    setType(expense.type);
    setTransactionType(expense.amount >= 0 ? 'INCOME' : 'EXPENSE');

    // Switch to the tab where the item is, so user sees what they are editing contextually
    setActiveTab(expense.type);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    // Reset date to today? Or keep? Keep last used.
    setTransactionType('EXPENSE');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const numAmount = parseFloat(amount);
    const finalAmount = transactionType === 'EXPENSE' ? -Math.abs(numAmount) : Math.abs(numAmount);

    if (editingId) {
      updateDailyExpense(editingId, {
        date,
        description,
        amount: finalAmount,
        type
      });
      setEditingId(null);
    } else {
      addDailyExpense({
        date,
        description,
        amount: finalAmount,
        type
      });
    }
    
    setDescription('');
    setAmount('');
    // Keep date as is for consecutive entries
  };

  const filteredExpenses = state.dailyExpenses.filter(e => e.type === activeTab);

  // Group expenses by date
  const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
    const date = expense.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {} as Record<string, DailyExpense[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedExpenses).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Günlük Defter</h1>
      </header>
      
      <Card title={editingId ? "Harcamayı Düzenle" : "Yeni Kazanç/Harcama Ekle"}>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
           <div className="flex gap-2">
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Tarih</label>
               <input 
                 type="date" 
                 value={date} 
                 onChange={(e) => setDate(e.target.value)}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
             <div className="flex-1 space-y-1">
               <label className="text-xs text-muted-foreground">Tutar</label>
               <input 
                 type="number" 
                 placeholder="0.00"
                 value={amount} 
                 onChange={(e) => setAmount(e.target.value)}
                 className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
               />
             </div>
           </div>
           
           <div className="space-y-1">
             <label className="text-xs text-muted-foreground">Açıklama</label>
             <input 
               type="text" 
               placeholder="Bu para nereden geldi/nereye gitti?"
               value={description} 
               onChange={(e) => setDescription(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
           </div>

           <div className="flex gap-2 pt-1">
             <button
               type="button"
               onClick={() => setTransactionType('INCOME')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${transactionType === 'INCOME' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
             >
               Gelir (+)
             </button>
             <button
               type="button"
               onClick={() => setTransactionType('EXPENSE')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${transactionType === 'EXPENSE' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
             >
               Gider (-)
             </button>
           </div>

           <div className="flex gap-2">
             <button
               type="button"
               onClick={() => { setType('NAKIT'); setActiveTab('NAKIT'); }}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${type === 'NAKIT' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}
             >
               <Wallet size={16} /> Nakit
             </button>
             <button
               type="button"
               onClick={() => { setType('YK'); setActiveTab('YK'); }}
               className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${type === 'YK' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}
             >
               <CreditCard size={16} /> Yemek Kartı
             </button>
           </div>
           
           <div className="flex gap-2 mt-2">
             {editingId && (
               <button
                 type="button"
                 onClick={cancelEdit}
                 className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
               >
                 <X size={20} /> İptal
               </button>
             )}
             <button
               type="submit"
               className="flex-[2] py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
             >
               {editingId ? 'Güncelle' : 'Ekle'}
             </button>
           </div>
        </form>
      </Card>

      {/* Tabs */}
      <div className="flex p-1 bg-secondary rounded-xl">
        <button
          onClick={() => setActiveTab('NAKIT')}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
            activeTab === 'NAKIT' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Nakit Harcamalar
        </button>
        <button
          onClick={() => setActiveTab('YK')}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
            activeTab === 'YK' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Yemek Kartı Harcamaları
        </button>
      </div>

      <div className="space-y-6">
        {sortedDates.map((date) => (
          <div key={date} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground ml-1">
              {format(new Date(date), 'd MMMM yyyy, EEEE', { locale: tr })}
            </h3>
            {groupedExpenses[date].map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${expense.type === 'NAKIT' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {expense.type === 'NAKIT' ? <Banknote size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <div className="font-medium">{expense.description}</div>
                    </div>
                </div>

                <div className="text-right">
                    <div className={`font-bold whitespace-nowrap ${expense.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {expense.amount > 0 ? '+' : ''}
                      {expense.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                    </div>
                    <div className="flex justify-end gap-3 mt-1">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Pencil size={12} /> Düzenle
                      </button>
                      <button
                        onClick={() => deleteDailyExpense(expense.id)}
                        className="text-xs text-destructive hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {sortedDates.length === 0 && (
          <div className="text-center text-muted-foreground py-12 bg-secondary/30 rounded-xl border border-dashed">
            {activeTab === 'NAKIT' ? 'Nakit' : 'Yemek Kartı'} için henüz kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}
