import { useState, useEffect } from 'react';
import { useDraftState } from '../hooks/useDraftState';
import { useBudget, isFixedExpenseOverdue, daysInMonth } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CheckCircle, Circle, Pencil, X, Calendar, Check } from 'lucide-react';
import { cn, scrollToElement } from '../lib/utils';
import type { FixedExpense } from '../types';
import { VaultSection } from '../components/VaultSection';
import { PlannedVaultSection } from '../components/PlannedVaultSection';


const formatTitleCase = (str: string) => {
  if (str === 'NAKIT') return 'Türk Lirası';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

export default function FixedExpenses() {
  const { isAdmin } = useAuth();
  const {
    state,
    viewDate,
    addFixedExpense,
    updateFixedExpense,
    toggleFixedExpense,
    deleteFixedExpense,
    addCustomIncome,
    deleteCustomIncome,
    updateIncome,
    updateRollover,
    updateYkIncome,
    updateYkRollover,
    dailyAllowance,
    updateDailyAllowance,
    showMealCard,
    showVault,
    vaultRecords,
    askConfirmation
  } = useBudget();

  const isGoldType = (type: string) => {
    const lower = type.toLowerCase();
    const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
    return goldKeywords.some(kw => lower.includes(kw));
  };

  const activeCurrencies = Array.from(new Set(
    vaultRecords
      .map(r => r.gold_type)
      .filter(t => !isGoldType(t))
  ));

  const [title, setTitle] = useDraftState('fixed_draft_title', '');
  const [amount, setAmount] = useDraftState('fixed_draft_amount', '');
  const [expenseType, setExpenseType] = useState('NAKIT');
  const [editingId, setEditingId] = useDraftState<string | null>('fixed_draft_editing_id', null);

  const [incomeTitle, setIncomeTitle] = useDraftState('fixed_draft_inc_title', '');
  const [incomeAmount, setIncomeAmount] = useDraftState('fixed_draft_inc_amount', '');
  const [incomeType, setIncomeType] = useState('NAKIT');

  // Gunluk harclik girdisi yerel tutulur: hesap yazarken anlik gorunur ama
  // global state'e ancak tik tusuna basilinca yazilir.
  const [allowanceInput, setAllowanceInput] = useState('');
  const [income, setIncome] = useState(state.income.toString());
  const [rollover, setRollover] = useState(state.rollover.toFixed(2));
  const [ykIncome, setYkIncome] = useState((state.ykIncome || 0).toString());
  const [ykRollover, setYkRollover] = useState((state.ykRollover || 0).toFixed(2));

  useEffect(() => {
    setIncome(state.income.toString());
    setRollover(Number(state.rollover).toFixed(2));
    setYkIncome((state.ykIncome || 0).toString());
    setYkRollover(Number(state.ykRollover || 0).toFixed(2));
    setAllowanceInput(dailyAllowance > 0 ? String(dailyAllowance) : '');
  }, [state.income, state.rollover, state.ykIncome, state.ykRollover, viewDate, dailyAllowance]);

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
    setExpenseType(expense.type || 'NAKIT');
    scrollToElement('main-form-container');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setExpenseType('NAKIT');

    sessionStorage.removeItem('fixed_draft_title');
    sessionStorage.removeItem('fixed_draft_amount');
    sessionStorage.removeItem('fixed_draft_editing_id');
  };

  const handleAddCustomIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeTitle || !incomeAmount) return;

    addCustomIncome({
      title: incomeTitle,
      amount: parseFloat(incomeAmount),
      type: incomeType
    });
    setIncomeTitle('');
    setIncomeAmount('');
    setIncomeType('NAKIT');

    sessionStorage.removeItem('fixed_draft_inc_title');
    sessionStorage.removeItem('fixed_draft_inc_amount');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    if (editingId) {
      updateFixedExpense(editingId, {
        title,
        amount: parseFloat(amount),
        type: expenseType
      });
      setEditingId(null);
    } else {
      addFixedExpense({ title, amount: parseFloat(amount), type: expenseType });
    }

    setTitle('');
    setAmount('');
    setExpenseType('NAKIT');
  };

  const getLocalDateMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isFuture = viewDate > getLocalDateMonth();
  const isCurrentMonth = viewDate === getLocalDateMonth();

  // Nakit harclik: hesap ANLIK (yazarken), uygulama ONAYA bagli (tik tusu).
  // previewDaily/previewTotal yazilan degerden turer; dailyAllowance ise
  // onaylanmis (state'e yazilmis) degerdir. Ikisi farkliysa bekleyen degisiklik var.
  const previewDaily = parseFloat(allowanceInput) || 0;
  const previewTotal = previewDaily * daysInMonth(viewDate);
  const allowancePending = previewDaily !== dailyAllowance;
  const applyAllowance = () => updateDailyAllowance(previewDaily);
  const formatTL = (n: number) =>
    n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 })
      .replace(/\s/g, '');
  const formattedMonth = new Date(
      parseInt(viewDate.split('-')[0]),
      parseInt(viewDate.split('-')[1]) - 1
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  // Exclude PLANNED_VAULT from standard currency list
  const fixedExpenseCurrencies = Array.from(new Set(
      state.fixedExpenses.filter(e => e.type !== 'PLANNED_VAULT').map(e => e.type || 'NAKIT')
  ));

  // If we only have PLANNED_VAULT (which acts as NAKIT), we should ensure NAKIT is in the currencies list
  // so that the summary displays "Türk Lirası Toplam Gider" correctly including planned ones.
  const hasPlannedVault = state.fixedExpenses.some(e => e.type === 'PLANNED_VAULT');
  if (hasPlannedVault && !fixedExpenseCurrencies.includes('NAKIT')) {
      fixedExpenseCurrencies.push('NAKIT');
  }

  return (
    <div id="main-form-container" className="space-y-6 pb-20 p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Varlıklarım</h1>
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Sabit Gelirler</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span className="capitalize">{formattedMonth}</span>
            {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded ml-2">Planlama Modu</span>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Aylık Gelir (TL)">
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

        <Card title="Devreden (TL)">
          <div className="mt-2">
             <input
               type="number"
               value={rollover}
               onChange={(e) => setRollover(e.target.value)}
               onBlur={handleRolloverSave}
               disabled={isFuture || viewDate < getLocalDateMonth()}
               className={cn(
                 "w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                 (isFuture || viewDate < getLocalDateMonth()) && "opacity-50 cursor-not-allowed bg-secondary/30"
               )}
             />
             {isFuture && <div className="text-xs text-muted-foreground mt-1">Önceki aydan tahmini devir</div>}
             {viewDate < getLocalDateMonth() && <div className="text-xs text-muted-foreground mt-1">Geçmiş devir otomatik hesaplanır</div>}
          </div>
        </Card>

        {showMealCard && (
            <>
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
                    disabled={isFuture || viewDate < getLocalDateMonth()}
                    className={cn(
                        "w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                        (isFuture || viewDate < getLocalDateMonth()) && "opacity-50 cursor-not-allowed bg-secondary/30"
                    )}
                    />
                    {isFuture && <div className="text-xs text-muted-foreground mt-1">Önceki aydan tahmini devir</div>}
                    {viewDate < getLocalDateMonth() && <div className="text-xs text-muted-foreground mt-1">Geçmiş devir otomatik hesaplanır</div>}
                </div>
                </Card>
            </>
        )}

      </div>

      <div className="mt-6 mb-8 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Ek Sabit Gelirler</h2>
        <form onSubmit={handleAddCustomIncome} className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            type="text"
            placeholder="Gelir Adı (örn: Kira Geliri)"
            value={incomeTitle}
            onChange={(e) => setIncomeTitle(e.target.value)}
            className="w-full sm:flex-[2] min-w-0 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="number"
              placeholder="Tutar"
              value={incomeAmount}
              onChange={(e) => setIncomeAmount(e.target.value)}
              className="flex-[2] min-w-0 sm:flex-none sm:w-24 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              className="flex-1 min-w-0 sm:flex-none sm:w-28 px-2 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              <option value="NAKIT">TL</option>
              {activeCurrencies.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
            <button
              type="submit"
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus size={24} />
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {state.customIncomes?.map((income) => (
            <div key={income.id} className="flex items-center justify-between p-3 rounded-lg glass gap-2">
              <span className="font-medium break-words min-w-0">{income.title}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-green-500">
                  +{income.amount.toLocaleString('tr-TR')}{income.type && isGoldType(income.type) ? ' ' : ''}{income.type === 'NAKIT' || !income.type ? '₺' : income.type}
                </span>
                <button
                  onClick={async () => { if (await askConfirmation('Bu geliri silmek istediğinize emin misiniz?')) { deleteCustomIncome(income.id); } }}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {(!state.customIncomes || state.customIncomes.length === 0) && (
            <div className="text-center p-4 text-muted-foreground text-sm bg-secondary/50 rounded-lg border border-border/50 border-dashed">
              Bu ay için eklenmiş sabit gelir bulunmuyor.
            </div>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mt-8">Sabit Giderler</h1>

      {/* Nakit harclik yalnizca GELECEK aylar icin ayrilir. Icinde bulunulan aya
          gecildiginde kalem cozulur ve tutari Kalan Turk Lirasi'na doner. */}
      {isFuture && (
        <Card title="Nakit Harçlık (Bu Ay İçin Ayrılan)" className="bg-gradient-to-br from-transparent to-emerald-500/12 border-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Günlük tutar (TL)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={allowanceInput}
                  onChange={(e) => setAllowanceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAllowance(); } }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                {/* Hesap anlik yapilir; kalem ancak bu tusa basilinca olusur. */}
                <button
                  type="button"
                  onClick={applyAllowance}
                  disabled={!allowancePending}
                  title={allowancePending ? 'Onayla' : 'Onaylanacak değişiklik yok'}
                  className={cn(
                    "px-3 rounded-lg font-medium transition-all flex items-center justify-center shrink-0",
                    allowancePending
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
                  )}
                >
                  <Check size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 text-sm">
              {previewDaily > 0 ? (
                <div className="text-muted-foreground">
                  <span className={cn(
                    "font-bold text-lg",
                    allowancePending ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-500"
                  )}>
                    {formatTL(previewTotal)}
                  </span>
                  <div className="text-xs mt-0.5">{daysInMonth(viewDate)} gün × günlük tutar</div>
                  {allowancePending && (
                    <div className="text-xs mt-1 text-emerald-600 dark:text-emerald-500 font-medium">
                      Uygulamak için ✓ tuşuna bas
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Günlük tutar yazarsan, bu ayın bütçesinden ayrılıp aşağıda gider olarak görünür.
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
            Bu aya geçildiğinde kalem otomatik çözülür ve tutarı <strong>Kalan Türk Lirası</strong>'na eklenir.
          </div>
        </Card>
      )}

      <Card title="Gider Özeti" className="bg-gradient-to-br from-transparent to-primary/10">
        <div className="space-y-4 mt-2">
          {fixedExpenseCurrencies.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sabit gider bulunmuyor.</div>
          ) : (
            fixedExpenseCurrencies.map(curr => {
              // Calculate total and paid. If curr is NAKIT, also add PLANNED_VAULT amounts.
              const expensesForCurr = state.fixedExpenses.filter(e => {
                  if (e.isBill) return false;
                  const type = e.type || 'NAKIT';
                  if (curr === 'NAKIT' && type === 'PLANNED_VAULT') return true;
                  return type === curr;
              });

              const total = expensesForCurr.reduce((sum, e) => sum + e.amount, 0);
              const paid = expensesForCurr.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
              return (
                <div key={curr} className="flex flex-col gap-1 border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <div className="text-xs font-bold text-primary tracking-wider">{formatTitleCase(curr)}</div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">Toplam Gider</div>
                      <div className="text-lg font-bold whitespace-nowrap">{total.toLocaleString('tr-TR')}{isGoldType(curr) ? ' ' : ''}{curr === 'NAKIT' ? '₺' : curr}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Ödenen</div>
                      <div className="text-md font-bold text-green-500 whitespace-nowrap">{paid.toLocaleString('tr-TR')}{isGoldType(curr) ? ' ' : ''}{curr === 'NAKIT' ? '₺' : curr}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <form id="edit-form-card" onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full">
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
            className="flex-1 min-w-0 sm:flex-none sm:w-24 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
            className="flex-1 min-w-0 sm:flex-none sm:w-28 px-2 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
          >
            <option value="NAKIT">TL</option>
            {activeCurrencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </select>

          {editingId && (
             <button
               type="button"
               onClick={cancelEdit}
               className="p-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 shrink-0"
             >
               <X size={24} />
             </button>
          )}

          <button
            type="submit"
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {editingId ? <Pencil size={24} /> : <Plus size={24} />}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {state.fixedExpenses.filter(e => e.type !== 'PLANNED_VAULT' && !e.isBill).map((expense) => (
          <div
            key={expense.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl glass transition-all",
              // Kira ve Kredi Karti icin uyari: bu ayda, odenmemisse kirmizi.
              // Kosul menu rozetiyle ORTAK (isFixedExpenseOverdue), ayrisamazlar.
              isCurrentMonth
                && isFixedExpenseOverdue(expense)
                && "border-red-500/60 bg-gradient-to-br from-transparent to-red-500/15",
              expense.isPaid && "opacity-60"
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
                <span className={cn("font-medium truncate block", expense.isPaid && "line-through")}>{expense.title}</span>
                <div className="text-sm text-muted-foreground whitespace-nowrap mt-0.5">
                  {expense.amount.toLocaleString('tr-TR')}{expense.type && isGoldType(expense.type) ? ' ' : ''}{expense.type === 'NAKIT' || !expense.type ? '₺' : expense.type}
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
                onClick={async (e) => { e.stopPropagation(); if (await askConfirmation('Bu sabit gideri silmek istediğinize emin misiniz?')) { deleteFixedExpense(expense.id); } }}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
        {state.fixedExpenses.filter(e => e.type !== 'PLANNED_VAULT' && !e.isBill).length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Henüz sabit gider eklenmemiş.
          </div>
        )}
      </div>

      {isAdmin && showVault && (
        <div className="space-y-6">
          <PlannedVaultSection />
          <VaultSection />
        </div>
      )}
    </div>
  );
}
