import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import type { DailyExpense } from '../types';
import { Card } from '../components/ui/Card';
import { Trash2, Banknote, CreditCard, Pencil, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import React, { useMemo, useEffect } from 'react';
import { tr } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function DailyExpenses() {
  const {
    state,
    viewDate,
    addDailyExpense,
    updateDailyExpense,
    deleteDailyExpense,
    showMealCard,
    vaultRecords
  } = useBudget();

  const isGoldType = (type: string) => {
    const lower = type.toLowerCase();
    const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
    return goldKeywords.some(kw => lower.includes(kw));
  };

  const activeCurrencies = useMemo(() => {
    return Array.from(new Set(
      vaultRecords
        .map(r => r.gold_type)
        .filter(t => !isGoldType(t))
    ));
  }, [vaultRecords]);

  const availableTabs = useMemo(() => {
    return ['NAKIT', ...(showMealCard ? ['YK'] : []), ...activeCurrencies];
  }, [showMealCard, activeCurrencies]);

  // Get local date YYYY-MM-DD
  const getLocalDate = () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
  };

  const [date, setDate] = useDraftState('daily_draft_date', getLocalDate());
  const [description, setDescription] = useDraftState('daily_draft_desc', '');
  const [amount, setAmount] = useDraftState('daily_draft_amount', '');
  const [type, setType] = useDraftState<string>('daily_draft_type', 'NAKIT');
  const [transactionType, setTransactionType] = useDraftState<'INCOME' | 'EXPENSE'>('daily_draft_tx_type', 'EXPENSE');
  const [activeTab, setActiveTab] = useDraftState<string>('daily_draft_tab', 'NAKIT');
  const [editingId, setEditingId] = useDraftState<string | null>('daily_draft_editing_id', null);

  // Fallback if active tab disappears (e.g. settings changed)
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('NAKIT');
    }
    if (!availableTabs.includes(type)) {
      setType('NAKIT');
    }
  }, [availableTabs, activeTab, type]);

  const uniqueDescriptions = useMemo(() => {
    const descriptions = new Set<string>();
    state.history.forEach(h => {
        h.dailyExpenses.forEach(e => {
            if (e.description) descriptions.add(e.description.trim());
        });
    });
    state.dailyExpenses.forEach(e => {
        if (e.description) descriptions.add(e.description.trim());
    });
    return Array.from(descriptions).filter(Boolean).sort();
  }, [state.history, state.dailyExpenses]);

  const activeExpenses = useMemo(() => {
    if (viewDate < state.currentMonth) {
      const historyEntry = state.history.find(h => h.month === viewDate);
      return historyEntry ? historyEntry.dailyExpenses : [];
    }
    return state.dailyExpenses;
  }, [viewDate, state.currentMonth, state.history, state.dailyExpenses]);

  const currentMonthSpent = useMemo(() => {
    return activeExpenses
      .filter(e => e.type === activeTab && e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [activeExpenses, activeTab]);

  const currentMonthIncome = useMemo(() => {
    return activeExpenses
      .filter(e => e.type === activeTab && e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses, activeTab]);

  const handleEdit = (expense: DailyExpense) => {
    setEditingId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setAmount(Math.abs(expense.amount).toString());
    setType(expense.type);
    setTransactionType(expense.amount >= 0 ? 'INCOME' : 'EXPENSE');
    setActiveTab(expense.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setTransactionType('EXPENSE');

    sessionStorage.removeItem('daily_draft_desc');
    sessionStorage.removeItem('daily_draft_amount');
    sessionStorage.removeItem('daily_draft_editing_id');
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

    sessionStorage.removeItem('daily_draft_desc');
    sessionStorage.removeItem('daily_draft_amount');
    sessionStorage.removeItem('daily_draft_editing_id');
  };

  const filteredExpenses = activeExpenses.filter(e => e.type === activeTab);

  const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
    const date = expense.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {} as Record<string, DailyExpense[]>);

  const sortedDates = Object.keys(groupedExpenses).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  );

  const getLocalMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isFuture = viewDate > getLocalMonth();
  const formattedMonth = new Date(
      parseInt(viewDate.split('-')[0]),
      parseInt(viewDate.split('-')[1]) - 1
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-20 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Günlük Defter</h1>
        <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span className="capitalize">{formattedMonth}</span>
            {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded ml-2">Planlama Modu</span>}
        </div>
      </header>
      
      {!isFuture ? (
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
                list="daily-expense-suggestions"
                placeholder="Bu para nereden geldi/nereye gitti?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <datalist id="daily-expense-suggestions">
                  {uniqueDescriptions.map((desc, idx) => (
                    <option key={idx} value={desc} />
                  ))}
                </datalist>
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

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ödeme Türü / Para Birimi</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); setActiveTab(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <option value="NAKIT">TL (Nakit)</option>
                  {showMealCard && <option value="YK">Yemek Kartı</option>}
                  {activeCurrencies.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
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
      ) : (
        <div className="text-center p-4 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Planlama modundasınız. Gelecek aylar için günlük harcama girilemez, sadece sabit gider planlaması yapılabilir.
        </div>
      )}

      {viewDate <= state.currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title={`Bu Ay Harcanan (${activeTab === 'NAKIT' ? 'Nakit' : activeTab === 'YK' ? 'Yemek Kartı' : activeTab})`} className="bg-red-500/5 border-red-500/20">
              <div className="text-2xl font-bold text-red-500 mt-2">
                 {currentMonthSpent.toLocaleString('tr-TR')} {activeTab === 'NAKIT' || activeTab === 'YK' ? '₺' : activeTab}
              </div>
            </Card>
            <Card title={`Bu Ayki Gelir (${activeTab === 'NAKIT' ? 'Nakit' : activeTab === 'YK' ? 'Yemek Kartı' : activeTab})`} className="bg-green-500/5 border-green-500/20">
              <div className="text-2xl font-bold text-green-500 mt-2">
                 {currentMonthIncome.toLocaleString('tr-TR')} {activeTab === 'NAKIT' || activeTab === 'YK' ? '₺' : activeTab}
              </div>
            </Card>
        </div>
      )}

      {availableTabs.length > 1 && (
        <div className="flex p-1 bg-secondary rounded-xl overflow-x-auto whitespace-nowrap scrollbar-none gap-1">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                    "flex-1 min-w-[100px] py-2 text-sm font-medium rounded-lg transition-all",
                    activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === 'NAKIT' ? 'Nakit' : tab === 'YK' ? 'Yemek Kartı' : tab}
              </button>
            ))}
        </div>
      )}

      <div className="space-y-6">
        {sortedDates.map((date) => {
          const dailyTotal = groupedExpenses[date].reduce((sum, item) => sum + item.amount, 0);
          return (
          <div key={date} className="space-y-3">
            <div className="flex justify-between items-center ml-1 pr-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                {format(new Date(date), 'd MMMM yyyy, EEEE', { locale: tr })}
              </h3>
              <span className={`text-sm font-bold ${dailyTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                 {dailyTotal > 0 ? '+' : ''}{dailyTotal.toLocaleString('tr-TR')} {activeTab === 'NAKIT' || activeTab === 'YK' ? '₺' : activeTab}
              </span>
            </div>
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
                      {expense.amount.toLocaleString('tr-TR')} {expense.type === 'NAKIT' || expense.type === 'YK' ? '₺' : expense.type}
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
          );
        })}

        {sortedDates.length === 0 && (
          <div className="text-center text-muted-foreground py-12 bg-secondary/30 rounded-xl border border-dashed">
            {activeTab === 'NAKIT' ? 'Nakit' : activeTab === 'YK' ? 'Yemek Kartı' : activeTab} için kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}
