import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CalendarClock, CreditCard, Pencil, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CCDebt } from '../types';

export default function Debt() {
  const { state, addCCDebt, updateCCDebt, deleteCCDebt, addInstallment, deleteInstallment } = useBudget();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // Taksit modu
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [transactionType, setTransactionType] = useState<'SPEND' | 'PAY'>('SPEND');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (debt: CCDebt) => {
    // If it's linked to an installment, warn or handle?
    // User requested "butun harcama kalemleri".
    // Editing a single month of an installment is possible via updateCCDebt.
    // We won't allow converting a debt to installment or vice versa easily here, just basic fields.
    setEditingId(debt.id);
    setDescription(debt.description);
    setAmount(Math.abs(debt.amount).toString());
    setTransactionType(debt.amount >= 0 ? 'PAY' : 'SPEND');
    setIsInstallment(false); // Can't toggle installment on existing debt edit for now

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setTransactionType('SPEND');
    setIsInstallment(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const numAmount = parseFloat(amount);

    if (editingId) {
        // Update existing debt
        const finalAmount = transactionType === 'PAY' ? Math.abs(numAmount) : -Math.abs(numAmount);
        updateCCDebt(editingId, {
            description,
            amount: finalAmount
        });
        setEditingId(null);
    } else {
        if (transactionType === 'PAY') {
            addCCDebt({ description, amount: Math.abs(numAmount) });
        } else {
            const debtAmount = -Math.abs(numAmount);

            if (isInstallment) {
              const count = parseInt(installmentCount);
              if (count < 2) return;

              addInstallment({
                description,
                totalAmount: debtAmount * count,
                installmentCount: count,
                monthlyAmount: debtAmount,
                startDate: new Date().toISOString()
              });
            } else {
              addCCDebt({ description, amount: debtAmount });
            }
        }
    }

    setDescription('');
    setAmount('');
    setIsInstallment(false);
    setInstallmentCount('2');
  };

  // Total Debt is sum. Spending is negative. Payment is positive.
  // Result is negative balance (e.g. -5000).
  // Display as positive magnitude.
  const totalDebt = Math.abs(state.ccDebts.reduce((sum, d) => sum + d.amount, 0));

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Kredi Kartı Borçları</h1>
      </header>

      <Card title="Bu Ay Ödenecek Toplam Kredi Kartı Borcu" className="bg-red-950/20 border-red-900/20">
        <div className="text-3xl font-bold text-red-500 mt-2">
          {totalDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </div>
      </Card>

      <Card title={editingId ? "İşlemi Düzenle" : "İşlem Ekle"}>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="flex gap-2">
             <button
               type="button"
               onClick={() => { setTransactionType('SPEND'); setIsInstallment(false); }}
               className={cn(
                 "flex-1 py-2 text-sm font-medium rounded-lg transition-colors border",
                 transactionType === 'SPEND' ? "bg-red-500/10 border-red-500 text-red-500" : "bg-secondary border-transparent text-muted-foreground"
               )}
             >
               Harcama (Borç)
             </button>
             <button
               type="button"
               onClick={() => { setTransactionType('PAY'); setIsInstallment(false); }}
               className={cn(
                 "flex-1 py-2 text-sm font-medium rounded-lg transition-colors border",
                 transactionType === 'PAY' ? "bg-green-500/10 border-green-500 text-green-500" : "bg-secondary border-transparent text-muted-foreground"
               )}
             >
               Ödeme (Yatırma)
             </button>
          </div>

          <div className="space-y-1">
             <label className="text-xs text-muted-foreground">Açıklama</label>
             <input
               type="text"
               placeholder="Harcama/Ödeme"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>

          <div className="flex gap-2">
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

             {isInstallment && (
               <div className="w-24 space-y-1">
                 <label className="text-xs text-muted-foreground">Taksit</label>
                 <input
                   type="number"
                   min="2"
                   max="24"
                   value={installmentCount}
                   onChange={(e) => setInstallmentCount(e.target.value)}
                   className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                 />
               </div>
             )}
          </div>

          <div className="flex items-center gap-2 pt-1">
             {transactionType === 'SPEND' && !editingId && (
               <button
                 type="button"
                 onClick={() => setIsInstallment(!isInstallment)}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors text-sm",
                   isInstallment ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-transparent text-muted-foreground"
                 )}
               >
                 <CalendarClock size={16} />
                 {isInstallment ? 'Taksitli' : 'Tek Çekim'}
               </button>
             )}

             {editingId && (
               <button
                 type="button"
                 onClick={cancelEdit}
                 className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
               >
                 <X size={20} /> İptal
               </button>
             )}

             <button
               type="submit"
               className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
             >
               {editingId ? <Pencil size={20} /> : <Plus size={20} />}
               {editingId ? 'Güncelle' : 'Ekle'}
             </button>
          </div>
        </form>
      </Card>

      {/* Active Installments Section */}
      {state.installments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Devam Eden Taksitler</h2>
          <div className="grid gap-3">
            {state.installments.map((inst) => {
               const current = inst.installmentCount - inst.remainingInstallments + 1;

               return (
                 <div key={inst.id} className="p-4 rounded-xl bg-secondary/30 border border-border">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <div className="font-medium">{inst.description}</div>
                         <div className="text-xs text-muted-foreground">
                           Toplam: {Math.abs(inst.totalAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-bold text-red-500">
                           {Math.abs(inst.monthlyAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}/ay
                         </div>
                         <div className="flex items-center justify-end gap-2 mt-1">
                            <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                              {current} / {inst.installmentCount}
                            </div>
                            <button
                              onClick={() => {
                                if (confirm('Bu taksit planını silmek istediğinize emin misiniz? Gelecek aylar için ödeme oluşmayacaktır.')) {
                                  deleteInstallment(inst.id);
                                }
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                         </div>
                       </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                       <div
                         className="h-full bg-primary transition-all"
                         style={{ width: `${(current / inst.installmentCount) * 100}%` }}
                       />
                    </div>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Bu Ayın Ekstresi</h2>
        {state.ccDebts.map((debt) => (
          <div key={debt.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
               <div className={cn("p-2 rounded-full", debt.amount > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                 <CreditCard size={20} />
               </div>
               <div className="font-medium">{debt.description}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className={cn("font-bold", debt.amount > 0 ? "text-green-500" : "text-red-500")}>
                {debt.amount > 0 ? '+' : ''}
                {debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleEdit(debt)}
                  className="text-primary hover:underline transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => deleteCCDebt(debt.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
