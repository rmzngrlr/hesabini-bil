import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import type { DailyExpense } from '../types';
import { Card } from '../components/ui/Card';
import { Trash2, Banknote, CreditCard, Pencil, X, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import React, { useMemo, useEffect, useState } from 'react';
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
    vaultRecords,
    addVaultRecord,
    updateVaultRecord,
    deleteVaultRecord,
    activeCurrencies,
    askConfirmation
  } = useBudget();

  const isGoldType = (type: string) => {
    const lower = type.toLowerCase();
    const goldKeywords = ['gram', 'çeyrek', 'yarım', 'tam', 'ata', 'reşat', 'ayar', 'bilezik', 'altın', 'has', 'külçe'];
    return goldKeywords.some(kw => lower.includes(kw));
  };

  const getAssetFullTitle = (name: string): string => {
    const lower = name.trim().toLowerCase();
    
    // Gold types
    if (isGoldType(name)) {
      if (lower.includes('altın') || lower.includes('lira')) return name; // e.g. "Has Altın", "Ata Lira"
      if (lower === 'gram') return 'Gram Altın';
      if (lower === 'çeyrek') return 'Çeyrek Altın';
      if (lower === 'yarım') return 'Yarım Altın';
      if (lower === 'tam') return 'Tam Altın';
      if (lower === 'ata') return 'Ata Altın';
      if (lower === 'reşat') return 'Reşat Altın';
      if (lower === 'bilezik') return 'Bilezik Altın';
      if (lower === 'külçe') return 'Külçe Altın';
      return `${name} Altın`;
    }

    // Currency types
    const mapping: Record<string, string> = {
      'nakit': 'Türk Lirası',
      'tl': 'Türk Lirası',
      'yk': 'Yemek Kartı',
      'yemek kartı': 'Yemek Kartı',
      'bam': 'Bosna-Hersek Markı',
      'bosna-hersek markı': 'Bosna-Hersek Markı',
      'usd': 'Amerikan Doları',
      'dolar': 'Amerikan Doları',
      'amerikan doları': 'Amerikan Doları',
      'eur': 'Euro',
      'euro': 'Euro',
      'gbp': 'İngiliz Sterlini',
      'sterlin': 'İngiliz Sterlini',
      'ingiliz sterlini': 'İngiliz Sterlini',
      'chf': 'İsviçre Frangı',
      'frang': 'İsviçre Frangı',
      'isviçre frangı': 'İsviçre Frangı',
      'cad': 'Kanada Doları',
      'kanada doları': 'Kanada Doları',
      'aud': 'Avustralya Doları',
      'avustralya doları': 'Avustralya Doları',
      'rub': 'Rus Rublesi',
      'ruble': 'Rus Rublesi',
      'rus rublesi': 'Rus Rublesi',
      'jpy': 'Japon Yeni',
      'yen': 'Japon Yeni',
      'japon yeni': 'Japon Yeni',
      'sar': 'Suudi Arabistan Riyali',
      'riyali': 'Suudi Arabistan Riyali',
      'suudi arabistan riyali': 'Suudi Arabistan Riyali',
      'aed': 'Birleşik Arap Emirlikleri Dirhemi',
      'dirhem': 'Birleşik Arap Emirlikleri Dirhemi',
      'birleşik arap emirlikleri dirhemi': 'Birleşik Arap Emirlikleri Dirhemi',
      'kwd': 'Kuveyt Dinarı',
      'dinar': 'Kuveyt Dinarı',
      'kuveyt dinarı': 'Kuveyt Dinarı',
    };
    
    const fallback = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return mapping[lower] || fallback;
  };

  const allFormTypes = useMemo(() => {
    const defaultGolds = ["Gram", "Çeyrek", "Yarım", "Tam", "Ata Lira"];
    const recordsGolds = vaultRecords
      .map(r => r.gold_type)
      .filter(t => isGoldType(t));
    const allGolds = Array.from(new Set([...defaultGolds, ...recordsGolds]));
    return {
      currencies: ['NAKIT', ...(showMealCard ? ['YK'] : []), ...activeCurrencies],
      golds: allGolds
    };
  }, [showMealCard, activeCurrencies, vaultRecords]);

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
  const [customCurrencyCode, setCustomCurrencyCode] = useState('');

  const [goldOwner, setGoldOwner] = useDraftState('daily_draft_gold_owner', '');
  const [goldNote, setGoldNote] = useDraftState('daily_draft_gold_note', '');
  const [goldPriceTL, setGoldPriceTL] = useDraftState('daily_draft_gold_price_tl', '');
  const [goldTransactionType, setGoldTransactionType] = useDraftState<'Birikim' | 'Bozdurma' | 'Borç Verdim'>('daily_draft_gold_tx_type', 'Birikim');




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

  const activeCurrenciesFiltered = useMemo(() => {
    return activeCurrencies.filter(curr => {
      return activeExpenses.some(e => e.type === curr);
    });
  }, [activeCurrencies, activeExpenses]);

  const availableTabs = useMemo(() => {
    return ['NAKIT', ...(showMealCard ? ['YK'] : []), ...activeCurrenciesFiltered];
  }, [showMealCard, activeCurrenciesFiltered]);

  // Fallback if active tab disappears (e.g. settings changed)
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('NAKIT');
    }
    if (type !== 'NEW_CURRENCY' && !allFormTypes.currencies.includes(type) && !allFormTypes.golds.includes(type)) {
      setType('NAKIT');
    }
  }, [availableTabs, allFormTypes, activeTab, type]);

  // Reset date draft if it belongs to a past day
  useEffect(() => {
    const today = getLocalDate();
    const cached = sessionStorage.getItem('daily_draft_date');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed !== today) {
          sessionStorage.removeItem('daily_draft_date');
          setDate(today);
        }
      } catch (e) {
        sessionStorage.removeItem('daily_draft_date');
        setDate(today);
      }
    }
  }, []);

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
    setAmount(Math.abs(expense.amount).toString());
    setType(expense.type);
    setTransactionType(expense.amount >= 0 ? 'INCOME' : 'EXPENSE');
    setActiveTab(expense.type);

    if (isGoldType(expense.type)) {
      const ownerMatch = expense.description.match(/Kime Ait:\s*([^|]+)/);
      const noteMatch = expense.description.match(/Not:\s*(.+)/);
      setGoldOwner(ownerMatch ? ownerMatch[1].trim() : '');
      setGoldNote(noteMatch ? noteMatch[1].trim() : '');
      setDescription('');
    } else {
      setDescription(expense.description);
      setGoldOwner('');
      setGoldNote('');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setTransactionType('EXPENSE');
    setGoldOwner('');
    setGoldNote('');

    sessionStorage.removeItem('daily_draft_desc');
    sessionStorage.removeItem('daily_draft_amount');
    sessionStorage.removeItem('daily_draft_editing_id');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    if (isGoldType(type) && !goldOwner) return;
    if (!isGoldType(type) && !description) return;

    const numAmount = parseFloat(amount);

    if (isGoldType(type)) {
      const finalDesc = `Kime Ait: ${goldOwner}${goldNote ? ' | Not: ' + goldNote : ''}`;
      
      if (editingId) {
        const originalExpense = activeExpenses.find(ex => ex.id === editingId);
        if (originalExpense) {
          updateDailyExpense(editingId, {
            date,
            description: finalDesc,
            amount: numAmount,
            type
          });

          // Sync to Vault (Kasa) records
          const match = vaultRecords.find(r => 
            r.gold_type === originalExpense.type && 
            Number(r.amount) === Number(Math.abs(originalExpense.amount)) && 
            r.record_date === originalExpense.date
          );
          if (match && match.id) {
            await updateVaultRecord(match.id, {
              record_date: date,
              owner: goldOwner,
              gold_type: type,
              amount: numAmount,
              note: goldNote,
              transaction_type: goldTransactionType
            });
          }
        }
        setEditingId(null);
      } else {
        // Add flow
        // 1. Add to Vault only! (As requested: "Giriş olarak ekleyeyim ama Kasa kısmına eklese yeter.")
        await addVaultRecord({
          record_date: date,
          owner: goldOwner,
          gold_type: type,
          amount: numAmount,
          note: goldNote,
          transaction_type: goldTransactionType
        });

        // 2. If purchase/sale price is provided, add corresponding TL daily expense
        if (goldPriceTL && (goldTransactionType === 'Birikim' || goldTransactionType === 'Bozdurma')) {
          const tlAmount = parseFloat(goldPriceTL);
          if (!isNaN(tlAmount) && tlAmount > 0) {
            const isSale = goldTransactionType === 'Bozdurma'; // Bozdurma is sale (gold EXPENSE, cash INCOME)
            const tlFinalAmount = isSale ? tlAmount : -tlAmount;
            const tlDesc = isSale ? `Altın Satışı: ${numAmount} ${type}` : `Altın Alımı: ${numAmount} ${type}`;
            
            addDailyExpense({
              date,
              description: tlDesc,
              amount: tlFinalAmount,
              type: 'NAKIT' // TL
            });
          }
        }
      }
      setGoldOwner('');
      setGoldNote('');
      setGoldPriceTL('');
    } else {
      const finalAmount = transactionType === 'EXPENSE' ? -Math.abs(numAmount) : Math.abs(numAmount);
      let finalType = type;
      if (type === 'NEW_CURRENCY') {
        if (!customCurrencyCode) return;
        finalType = customCurrencyCode;
      }

      if (editingId) {
        if (editingId.startsWith('vault-curr-')) {
          const vaultId = parseInt(editingId.replace('vault-curr-', ''));
          if (!isNaN(vaultId)) {
            const isExpense = finalAmount < 0;
            await updateVaultRecord(vaultId, {
              record_date: date,
              amount: Math.abs(finalAmount),
              note: description,
              transaction_type: isExpense ? 'Borç Verdim' : 'Birikim',
              gold_type: finalType
            });
          }
        } else {
          updateDailyExpense(editingId, {
            date,
            description,
            amount: finalAmount,
            type: finalType
          });
        }
        setEditingId(null);
      } else {
        addDailyExpense({
          date,
          description,
          amount: finalAmount,
          type: finalType
        });
        setType(finalType);
        setActiveTab(finalType);
        setCustomCurrencyCode('');
      }
      setDescription('');
    }
    
    setAmount('');

    sessionStorage.removeItem('daily_draft_desc');
    sessionStorage.removeItem('daily_draft_amount');
    sessionStorage.removeItem('daily_draft_editing_id');
  };

  const handleDeleteClick = async (expense: DailyExpense) => {
    if (!await askConfirmation('Bu işlemi silmek istediğinize emin misiniz?')) return;

    if (expense.id.startsWith('vault-curr-')) {
      const vaultId = parseInt(expense.id.replace('vault-curr-', ''));
      if (!isNaN(vaultId)) {
        await deleteVaultRecord(vaultId);
      }
    } else {
      if (isGoldType(expense.type)) {
        // Find and delete from vault records
        const match = vaultRecords.find(r => 
          r.gold_type === expense.type && 
          Number(r.amount) === Number(Math.abs(expense.amount)) && 
          r.record_date === expense.date
        );
        if (match && match.id) {
          await deleteVaultRecord(match.id);
        }
      }
      deleteDailyExpense(expense.id);
    }
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
        <Card title={editingId ? "Kayıt Düzenle" : "Yeni Kazanç/Harcama Ekle"}>
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
                <label className="text-xs text-muted-foreground">{isGoldType(type) ? 'Miktar' : 'Tutar'}</label>
                <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                </div>
            </div>

            {isGoldType(type) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Kime Ait</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet"
                      value={goldOwner}
                      onChange={(e) => setGoldOwner(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Not</label>
                    <input
                      type="text"
                      placeholder="İsteğe Bağlı"
                      value={goldNote}
                      onChange={(e) => setGoldNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                {goldTransactionType !== 'Borç Verdim' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      {goldTransactionType === 'Bozdurma' ? 'Satış Tutarı (TL) - İsteğe Bağlı' : 'Alış Tutarı (TL) - İsteğe Bağlı'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={goldPriceTL}
                      onChange={(e) => setGoldPriceTL(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Açıklama</label>
                <input
                  type="text"
                  required
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
            )}

            {isGoldType(type) ? (
              <div className="flex gap-2 pt-1">
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Birikim'); setTransactionType('INCOME'); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${goldTransactionType === 'Birikim' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                  >
                  Birikim
                  </button>
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Bozdurma'); setTransactionType('EXPENSE'); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${goldTransactionType === 'Bozdurma' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                  >
                  Bozdurma
                  </button>
                  <button
                  type="button"
                  onClick={() => { setGoldTransactionType('Borç Verdim'); setTransactionType('EXPENSE'); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${goldTransactionType === 'Borç Verdim' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                  >
                  Borç Verdim
                  </button>
              </div>
            ) : (
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
            )}

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Varlık / Para Birimi</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); if (e.target.value !== 'NEW_CURRENCY') setActiveTab(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <optgroup label="Para Birimleri">
                    <option value="NAKIT">Türk Lirası</option>
                    {showMealCard && <option value="YK">Yemek Kartı</option>}
                    {activeCurrencies.map(curr => (
                      <option key={curr} value={curr}>{getAssetFullTitle(curr)}</option>
                    ))}
                    <option value="NEW_CURRENCY">+ Diğer Para Birimi Ekle...</option>
                  </optgroup>
                  <optgroup label="Altın Türleri (Kasa)">
                    {allFormTypes.golds.map(gold => (
                      <option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>
                    ))}
                  </optgroup>
                </select>
            </div>

            {type === 'NEW_CURRENCY' && (
              <div className="space-y-1 mt-2">
                <label className="text-xs text-muted-foreground">Yeni Para Birimi Kodu (Örn: USD, EUR, GBP)</label>
                <input
                  type="text"
                  required
                  placeholder="Döviz Kodu (Büyük Harf)"
                  value={customCurrencyCode}
                  onChange={(e) => setCustomCurrencyCode(e.target.value.toUpperCase().trim())}
                  className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>
            )}

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
            <Card title={`${isGoldType(activeTab) ? 'Toplam Birikim' : 'Bu Ay Harcanan'} (${getAssetFullTitle(activeTab)})`} className={`${isGoldType(activeTab) ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className={`text-2xl font-bold mt-2 ${isGoldType(activeTab) ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-500'}`}>
                 {isGoldType(activeTab) ? (currentMonthIncome - currentMonthSpent).toLocaleString('tr-TR') : currentMonthSpent.toLocaleString('tr-TR')} {activeTab === 'NAKIT' || activeTab === 'YK' ? '₺' : activeTab}
              </div>
            </Card>
            <Card title={`Bu Ayki Gelir / Giriş (${getAssetFullTitle(activeTab)})`} className="bg-green-500/5 border-green-500/20">
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
                {getAssetFullTitle(tab)}
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
            {groupedExpenses[date].map((expense) => {
              const isGold = isGoldType(expense.type);
              return (
              <div key={expense.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${expense.type === 'NAKIT' ? 'bg-green-500/10 text-green-500' : isGold ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
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
                        onClick={() => handleDeleteClick(expense)}
                        className="text-xs text-destructive hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                </div>
              </div>
              );
            })}
          </div>
          );
        })}

        {sortedDates.length === 0 && (
          <div className="text-center text-muted-foreground py-12 bg-secondary/30 rounded-xl border border-dashed">
            {activeTab === 'NAKIT' ? 'TL' : activeTab === 'YK' ? 'Yemek Kartı' : activeTab} için kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}
