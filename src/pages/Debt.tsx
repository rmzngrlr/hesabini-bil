import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import React, { useMemo } from 'react';
import { Plus, Trash2, CalendarClock, CreditCard, Pencil, X } from 'lucide-react';
import { cn, scrollToElement, getTodayStr, isDebtPending } from '../lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { CCDebt } from '../types';

export default function Debt() {
  const { state, viewDate, addCCDebt, updateCCDebt, deleteCCDebt, addInstallment, deleteInstallment, addDailyExpense, askConfirmation, todayStr } = useBudget();
  const [description, setDescription] = useDraftState('debt_draft_desc', '');
  const [amount, setAmount] = useDraftState('debt_draft_amount', '');
  const [date, setDate] = useDraftState('debt_draft_date', getTodayStr());

  // Taksit modu
  const [isInstallment, setIsInstallment] = useDraftState('debt_draft_is_inst', false);
  const [installmentCount, setInstallmentCount] = useDraftState('debt_draft_inst_count', '2');
  const [transactionType, setTransactionType] = useDraftState<'SPEND' | 'PAY'>('debt_draft_tx_type', 'SPEND');
  const [editingId, setEditingId] = useDraftState<string | null>('debt_draft_editing_id', null);

  const uniqueDescriptions = useMemo(() => {
    const descriptions = new Set<string>();
    state.history.forEach(h => {
        h.ccDebts.forEach(d => {
            if (d.description) descriptions.add(d.description.trim());
        });
    });
    state.ccDebts.forEach(d => {
        if (d.description) descriptions.add(d.description.trim());
    });
    return Array.from(descriptions).filter(Boolean).sort();
  }, [state.history, state.ccDebts]);

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
    if (debt.date) {
        setDate(debt.date);
    } else {
        setDate(getTodayStr());
    }

    // Scroll to top
    scrollToElement('main-form-container');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setDate(getTodayStr());
    setTransactionType('SPEND');
    setIsInstallment(false);

    sessionStorage.removeItem('debt_draft_desc');
    sessionStorage.removeItem('debt_draft_amount');
    sessionStorage.removeItem('debt_draft_date');
    sessionStorage.removeItem('debt_draft_is_inst');
    sessionStorage.removeItem('debt_draft_inst_count');
    sessionStorage.removeItem('debt_draft_editing_id');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) return;

    const numAmount = parseFloat(amount);

    if (editingId) {
        // Update existing debt
        const finalAmount = transactionType === 'PAY' ? Math.abs(numAmount) : -Math.abs(numAmount);
        updateCCDebt(editingId, {
            description,
            amount: finalAmount,
            date
        });
        setEditingId(null);
    } else {
        if (transactionType === 'PAY') {
            addCCDebt({ description, amount: Math.abs(numAmount), date });
            // Otomatik olarak nakitten de düşmesini sağlıyoruz (Nakit gider olarak eklenir)
            addDailyExpense({
                // `date` zaten yerel "YYYY-MM-DD"; ISO'ya çevrilirse tam zaman damgası
                // olur ve İşlemler listesinde aynı gün ayrı bir grup olarak bölünür.
                date,
                description: description,
                amount: -Math.abs(numAmount),
                type: 'NAKIT'
            });
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
                startDate: new Date(date).toISOString()
              });
            } else {
              addCCDebt({ description, amount: debtAmount, date });
            }
        }
    }

    setDescription('');
    setAmount('');
    setDate(getTodayStr());
    setIsInstallment(false);
    setInstallmentCount('2');

    sessionStorage.removeItem('debt_draft_desc');
    sessionStorage.removeItem('debt_draft_amount');
    sessionStorage.removeItem('debt_draft_date');
    sessionStorage.removeItem('debt_draft_is_inst');
    sessionStorage.removeItem('debt_draft_inst_count');
    sessionStorage.removeItem('debt_draft_editing_id');
  };

  // Total Debt is sum. Spending is negative. Payment is positive.
  // Result is negative balance (e.g. -5000).
  // Display as positive magnitude.
  // Gunu gelmemis (bu ayda ileri tarihli) borclar toplama girmez; gunu gelince girer.
  const getLocalMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isCurrentMonth = viewDate === getLocalMonth();
  const totalDebt = Math.abs(
    state.ccDebts
      .filter(d => !isDebtPending(d.date, isCurrentMonth, todayStr))
      .reduce((sum, d) => sum + d.amount, 0)
  );
  const pendingCount = state.ccDebts.filter(d => isDebtPending(d.date, isCurrentMonth, todayStr)).length;

  const groupedDebts = useMemo(() => {
    const groups: Record<string, CCDebt[]> = {};
    const noDateGroup: CCDebt[] = [];

    state.ccDebts.forEach(debt => {
      if (debt.date) {
        if (!groups[debt.date]) groups[debt.date] = [];
        // Son eklenen borc/odeme gun icinde en ustte gorunsun diye basa ekle
        // (yeni kayitlar diziye sona eklendiginden unshift ile ters siralanir).
        // Islemler sayfasindaki gunluk liste ile ayni davranis.
        groups[debt.date].unshift(debt);
      } else {
        noDateGroup.unshift(debt);
      }
    });

    return { groups, noDateGroup };
  }, [state.ccDebts]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedDebts.groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedDebts.groups]);


  const isFuture = viewDate > getLocalMonth();
  const formattedMonth = new Date(
      parseInt(viewDate.split('-')[0]),
      parseInt(viewDate.split('-')[1]) - 1
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div id="main-form-container" className="space-y-6 pb-20 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Kredi Kartı Borçları</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock size={16} />
            <span className="capitalize">{formattedMonth}</span>
            {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded ml-2">Planlama Modu</span>}
        </div>
      </header>

      <Card title="Bu Ay Ödenecek Toplam Kredi Kartı Borcu" className="bg-gradient-to-br from-transparent to-red-500/12 border-red-500/25">
        <div className="text-3xl font-bold text-red-500 mt-2">
          {totalDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
        </div>
        {pendingCount > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            günü gelmemiş {pendingCount} kalem hariç
          </div>
        )}
      </Card>

      <div id="edit-form-card"><Card title={editingId ? "İşlemi Düzenle" : "İşlem Ekle"}>
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
               list="debt-expense-suggestions"
               placeholder="Harcama/Ödeme"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
             <datalist id="debt-expense-suggestions">
               {uniqueDescriptions.map((desc, idx) => (
                 <option key={idx} value={desc} />
               ))}
             </datalist>
          </div>

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
                 disabled={viewDate < getLocalMonth()}
                 className={cn(
                   "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors text-sm",
                   isInstallment ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-transparent text-muted-foreground",
                   viewDate < getLocalMonth() && "opacity-50 cursor-not-allowed"
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
          {viewDate < getLocalMonth() && (
             <div className="text-xs text-muted-foreground text-center mt-2">
                Geçmiş aylara yeni taksit planı eklenemez, sadece tek çekim harcama eklenebilir.
             </div>
          )}
        </form>
      </Card></div>

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
                           Toplam: {Math.abs(inst.totalAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-bold text-red-500">
                           {Math.abs(inst.monthlyAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}/ay
                         </div>
                         <div className="flex items-center justify-end gap-2 mt-1">
                            <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                              {current} / {inst.installmentCount}
                            </div>
                            <button
                              onClick={async () => {
                                if (await askConfirmation('Bu taksit planını silmek istediğinize emin misiniz? Gelecek aylar için ödeme oluşmayacaktır.')) {
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

      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Bu Ayın Ekstresi</h2>

        {sortedDates.map((date) => {
          const dailyTotal = groupedDebts.groups[date].reduce((sum, item) => sum + item.amount, 0);
          // Bu ayda gunu henuz gelmemis grup: soluk + "gunu gelmedi" etiketi.
          // Gunu gelince (todayStr canli oldugundan gece yarisi dahil) kendiliginden aktiflesir.
          const isPending = isDebtPending(date, isCurrentMonth, todayStr);
          return (
            <div key={date} className={cn("space-y-3 transition-opacity", isPending && "opacity-50")}>
              <div className="flex justify-between items-center ml-1 pr-1">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {format(new Date(date), 'd MMMM yyyy, EEEE', { locale: tr })}
                  {isPending && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-500 whitespace-nowrap">
                      günü gelmedi
                    </span>
                  )}
                </h3>
                <span className={cn("text-sm font-bold", dailyTotal >= 0 ? "text-green-500" : "text-red-500")}>
                  {dailyTotal > 0 ? '+' : ''}
                  {dailyTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
                </span>
              </div>

              {groupedDebts.groups[date].map((debt) => (
                <div key={debt.id} className="flex items-center justify-between p-4 rounded-xl glass">
                  <div className="flex items-center gap-3">
                     <div className={cn("p-2 rounded-full", debt.amount > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                       <CreditCard size={20} />
                     </div>
                     <div>
                       <div className="font-medium">{debt.description}</div>
                     </div>
                  </div>

                  <div className="text-right">
                    <div className={cn("font-bold whitespace-nowrap", debt.amount > 0 ? "text-green-500" : "text-red-500")}>
                      {debt.amount > 0 ? '+' : ''}
                      {debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
                    </div>
                    <div className="flex justify-end gap-3 mt-1">
                      <button
                        onClick={() => handleEdit(debt)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Pencil size={12} /> Düzenle
                      </button>
                      <button
                        onClick={async () => { if (await askConfirmation('Bu kredi kartı borç kaydını silmek istediğinize emin misiniz?')) { deleteCCDebt(debt.id); } }}
                        className="text-xs text-destructive hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {groupedDebts.noDateGroup.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center ml-1 pr-1">
              <h3 className="text-sm font-medium text-muted-foreground">Tarihsiz İşlemler</h3>
              <span className={cn(
                "text-sm font-bold",
                groupedDebts.noDateGroup.reduce((sum, item) => sum + item.amount, 0) >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {groupedDebts.noDateGroup.reduce((sum, item) => sum + item.amount, 0) > 0 ? '+' : ''}
                {groupedDebts.noDateGroup.reduce((sum, item) => sum + item.amount, 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
              </span>
            </div>

            {groupedDebts.noDateGroup.map((debt) => (
              <div key={debt.id} className="flex items-center justify-between p-4 rounded-xl glass">
                <div className="flex items-center gap-3">
                   <div className={cn("p-2 rounded-full", debt.amount > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                     <CreditCard size={20} />
                   </div>
                   <div>
                     <div className="font-medium">{debt.description}</div>
                   </div>
                </div>

                <div className="text-right">
                  <div className={cn("font-bold whitespace-nowrap", debt.amount > 0 ? "text-green-500" : "text-red-500")}>
                    {debt.amount > 0 ? '+' : ''}
                    {debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}
                  </div>
                  <div className="flex justify-end gap-3 mt-1">
                    <button
                      onClick={() => handleEdit(debt)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Pencil size={12} /> Düzenle
                    </button>
                    <button
                      onClick={async () => { if (await askConfirmation('Bu kredi kartı borç kaydını silmek istediğinize emin misiniz?')) { deleteCCDebt(debt.id); } }}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Sil
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

         {state.ccDebts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Borç kaydı bulunmamaktadır.
          </div>
        )}
      </div>
    </div>
  );
}
