import { useState, useEffect } from 'react';
import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, CheckCircle, Circle, Pencil, X, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { FixedExpense } from '../types';
import { VaultSection } from '../components/VaultSection';

function AssetBudgetCard({ asset }: { asset: string }) {
  const { state, updateAssetIncome, updateAssetRollover, viewDate } = useBudget();
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isFuture = viewDate > getLocalDate();
  
  const assetBudget = state.assetBudgets?.[asset] || { income: 0, rollover: 0 };
  const [localIncome, setLocalIncome] = useState(assetBudget.income.toString());
  const [localRollover, setLocalRollover] = useState(assetBudget.rollover.toString());

  useEffect(() => {
    setLocalIncome(assetBudget.income.toString());
    setLocalRollover(assetBudget.rollover.toString());
  }, [assetBudget.income, assetBudget.rollover, viewDate]);

  return (
    <>
      <Card title={`Aylık Gelir (${asset})`}>
        <div className="mt-2">
          <input
            type="number"
            value={localIncome}
            onChange={(e) => setLocalIncome(e.target.value)}
            onBlur={() => updateAssetIncome(asset, parseFloat(localIncome) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </Card>
      <Card title={`Devreden (${asset})`}>
        <div className="mt-2">
           <input
             type="number"
             value={localRollover}
             onChange={(e) => setLocalRollover(e.target.value)}
             onBlur={() => updateAssetRollover(asset, parseFloat(localRollover) || 0)}
             disabled={isFuture || viewDate < getLocalDate()}
             className={cn(
               "w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
               (isFuture || viewDate < getLocalDate()) && "opacity-50 cursor-not-allowed bg-secondary/30"
             )}
           />
           {isFuture && <div className="text-xs text-muted-foreground mt-1">Önceki aydan tahmini devir</div>}
           {viewDate < getLocalDate() && <div className="text-xs text-muted-foreground mt-1">Geçmiş devir otomatik hesaplanır</div>}
        </div>
      </Card>
    </>
  );
}

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
    showMealCard,
    showVault,
    vaultRecords
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

  const [income, setIncome] = useState(state.income.toString());
  const [rollover, setRollover] = useState(state.rollover.toFixed(2));
  const [ykIncome, setYkIncome] = useState((state.ykIncome || 0).toString());
  const [ykRollover, setYkRollover] = useState((state.ykRollover || 0).toFixed(2));

  useEffect(() => {
    setIncome(state.income.toString());
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
    setExpenseType(expense.type || 'NAKIT');
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
  const formattedMonth = new Date(
      parseInt(viewDate.split('-')[0]),
      parseInt(viewDate.split('-')[1]) - 1
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const fixedExpenseCurrencies = Array.from(new Set(state.fixedExpenses.map(e => e.type || 'NAKIT')));

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

        {activeCurrencies.map(curr => (
          <AssetBudgetCard key={curr} asset={curr} />
        ))}
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
              className="flex-[2] sm:flex-none sm:w-24 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              className="flex-1 sm:flex-none sm:w-28 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              <option value="NAKIT">TL (Nakit)</option>
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
            <div key={income.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50">
              <span className="font-medium">{income.title}</span>
              <div className="flex items-center gap-3">
                <span className="font-bold text-green-500">
                  +{income.amount.toLocaleString('tr-TR')} {income.type === 'NAKIT' || !income.type ? '₺' : income.type}
                </span>
                <button
                  onClick={() => deleteCustomIncome(income.id)}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
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

      <Card title="Gider Özeti" className="bg-gradient-to-br from-card to-primary/5">
        <div className="space-y-4 mt-2">
          {fixedExpenseCurrencies.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sabit gider bulunmuyor.</div>
          ) : (
            fixedExpenseCurrencies.map(curr => {
              const total = state.fixedExpenses.filter(e => (e.type || 'NAKIT') === curr).reduce((sum, e) => sum + e.amount, 0);
              const paid = state.fixedExpenses.filter(e => (e.type || 'NAKIT') === curr && e.isPaid).reduce((sum, e) => sum + e.amount, 0);
              return (
                <div key={curr} className="flex flex-col gap-1 border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <div className="text-xs font-bold text-primary tracking-wider uppercase">{curr === 'NAKIT' ? 'TL (Nakit)' : curr}</div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-xs text-muted-foreground">Toplam Gider</div>
                      <div className="text-lg font-bold whitespace-nowrap">{total.toLocaleString('tr-TR')} {curr === 'NAKIT' ? '₺' : curr}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Ödenen</div>
                      <div className="text-md font-bold text-green-500 whitespace-nowrap">{paid.toLocaleString('tr-TR')} {curr === 'NAKIT' ? '₺' : curr}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
            className="flex-1 sm:flex-none sm:w-24 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
            className="flex-1 sm:flex-none sm:w-28 px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
          >
            <option value="NAKIT">TL (Nakit)</option>
            {activeCurrencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </select>

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
                  {expense.amount.toLocaleString('tr-TR')} {expense.type === 'NAKIT' || !expense.type ? '₺' : expense.type}
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

      {isAdmin && showVault && <VaultSection />}
    </div>
  );
}
