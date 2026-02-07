import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CalendarClock, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Debt() {
  const { state, addCCDebt, deleteCCDebt, addInstallment, deleteInstallment } = useBudget();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // Taksit modu
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [transactionType, setTransactionType] = useState<'SPEND' | 'PAY'>('SPEND');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const numAmount = parseFloat(amount);

    if (transactionType === 'PAY') {
        // Payment adds positive amount
        addCCDebt({ description, amount: Math.abs(numAmount) });
    } else {
        // Spending adds negative amount (or installment with negative parts)
        // Installment logic handles sign internally? No, I need to pass negative.
        // Wait, context addInstallment logic:
        /*
          monthlyAmount: newInstallment.monthlyAmount, // passed as is
        */
        // So I should pass negative here.

        const debtAmount = -Math.abs(numAmount);

        if (isInstallment) {
          const count = parseInt(installmentCount);
          if (count < 2) return;

          addInstallment({
            description,
            totalAmount: debtAmount * count, // Negative total
            installmentCount: count,
            monthlyAmount: debtAmount, // Negative monthly
            startDate: new Date().toISOString()
          });
        } else {
          addCCDebt({ description, amount: debtAmount });
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

      <Card title="Bu Ay Ödenecek" className="bg-red-950/20 border-red-900/20">
        <div className="text-3xl font-bold text-red-500 mt-2">
          {totalDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </div>
      </Card>

      <Card title="İşlem Ekle">
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
               placeholder="Örn: Telefon, Market"
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
             {transactionType === 'SPEND' && (
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

             <button
               type="submit"
               className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
             >
               <Plus size={20} />
               Ekle
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
