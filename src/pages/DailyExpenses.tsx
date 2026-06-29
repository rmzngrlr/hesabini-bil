import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import type { DailyExpense } from '../types';
import { Card } from '../components/ui/Card';
import { Trash2, Banknote, CreditCard, Pencil, X, Calendar, ArrowRightLeft } from 'lucide-react';
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
      'syp': 'Suriye Lirası',
      'suriye lirası': 'Suriye Lirası',
      'cny': 'Çin Yuanı',
      'çin yuanı': 'Çin Yuanı',
      'sek': 'İsveç Kronu',
      'isveç kronu': 'İsveç Kronu',
      'nok': 'Norveç Kronu',
      'norveç kronu': 'Norveç Kronu',
      'dkk': 'Danimarka Kronu',
      'danimarka kronu': 'Danimarka Kronu',
      'azn': 'Azerbaycan Manatı',
      'azerbaycan manatı': 'Azerbaycan Manatı',
      'qar': 'Katar Riyali',
      'katar riyali': 'Katar Riyali',
      'iqd': 'Irak Dinarı',
      'irak dinarı': 'Irak Dinarı',
      'uah': 'Ukrayna Grivnası',
      'ukrayna grivnası': 'Ukrayna Grivnası',
      'inr': 'Hindistan Rupisi',
      'hindistan rupisi': 'Hindistan Rupisi',
      'egp': 'Mısır Lirası',
      'mısır lirası': 'Mısır Lirası',
      'krw': 'Güney Kore Wonu',
      'güney kore wonu': 'Güney Kore Wonu',
    };
    
    const fallback = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return mapping[lower] || fallback;
  };

  const detectCurrencyCode = (input: string): string => {
    const clean = input.trim().toLowerCase();
    
    // 1. Symbol mappings
    if (clean === '$') return 'USD';
    if (clean === '€') return 'EUR';
    if (clean === '£' || clean === '₤') return 'GBP';
    if (clean === '₽') return 'RUB';
    if (clean === '¥') return 'JPY';
    if (clean === '﷼') return 'SAR';
    if (clean === 'د.إ') return 'AED';
    if (clean === 'د.k' || clean === 'د.k') return 'KWD';
    if (clean === '₣') return 'CHF';
    if (clean === 'km') return 'BAM';
    if (clean === '₼') return 'AZN';
    if (clean === '₴') return 'UAH';
    if (clean === '₹') return 'INR';
    if (clean === '₩') return 'KRW';
    if (clean === 'ل.س') return 'SYP';

    // 2. Name mappings (Turkish and English)
    const lowerInput = clean
      .replace(/i̇/g, 'i')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o');
    
    if (lowerInput.includes('dolar') || lowerInput.includes('dollar') || lowerInput === 'usd') {
      if (lowerInput.includes('kanada') || lowerInput.includes('cad')) return 'CAD';
      if (lowerInput.includes('avustralya') || lowerInput.includes('aud')) return 'AUD';
      return 'USD';
    }
    
    if (lowerInput.includes('euro') || lowerInput === 'eur') {
      return 'EUR';
    }
    
    if (lowerInput.includes('bosna') || lowerInput.includes('hersek') || lowerInput.includes('marki') || lowerInput === 'bam' || lowerInput === 'km') {
      return 'BAM';
    }
    
    if (lowerInput.includes('sterlin') || lowerInput.includes('pound') || lowerInput === 'gbp') {
      return 'GBP';
    }
    
    if (lowerInput.includes('frank') || lowerInput.includes('isvicre') || lowerInput === 'chf') {
      return 'CHF';
    }
    
    if (lowerInput.includes('ruble') || lowerInput.includes('rublesi') || lowerInput === 'rub') {
      return 'RUB';
    }
    
    if (lowerInput.includes('yen') || lowerInput.includes('japon') || lowerInput === 'jpy') {
      return 'JPY';
    }
    
    if (lowerInput.includes('riyal') || lowerInput.includes('suudi') || lowerInput === 'sar') {
      if (lowerInput.includes('katar') || lowerInput === 'qar') return 'QAR';
      return 'SAR';
    }

    if (lowerInput.includes('suriye') || lowerInput === 'syp' || lowerInput.includes('syrian')) {
      return 'SYP';
    }
    
    if (lowerInput.includes('dirhem') || lowerInput.includes('emirlikleri') || lowerInput === 'aed') {
      return 'AED';
    }
    
    if (lowerInput.includes('dinar') || lowerInput.includes('kuveyt') || lowerInput === 'kwd') {
      if (lowerInput.includes('irak') || lowerInput === 'iqd') return 'IQD';
      return 'KWD';
    }

    if (lowerInput.includes('yuan') || lowerInput.includes('cin') || lowerInput === 'cny') {
      return 'CNY';
    }

    if (lowerInput.includes('isvec') || lowerInput === 'sek') {
      return 'SEK';
    }

    if (lowerInput.includes('norvec') || lowerInput === 'nok') {
      return 'NOK';
    }

    if (lowerInput.includes('danimarka') || lowerInput === 'dkk') {
      return 'DKK';
    }

    if (lowerInput.includes('manat') || lowerInput.includes('azerbaycan') || lowerInput === 'azn') {
      return 'AZN';
    }

    if (lowerInput.includes('katar') || lowerInput === 'qar') {
      return 'QAR';
    }

    if (lowerInput.includes('grivna') || lowerInput.includes('ukrayna') || lowerInput === 'uah') {
      return 'UAH';
    }

    if (lowerInput.includes('rupi') || lowerInput.includes('hindistan') || lowerInput === 'inr') {
      return 'INR';
    }

    if (lowerInput.includes('misir') || lowerInput === 'egp') {
      return 'EGP';
    }

    if (lowerInput.includes('won') || lowerInput.includes('kore') || lowerInput === 'krw') {
      return 'KRW';
    }

    if (input.length >= 3 && input.length <= 4) {
      return input.toUpperCase();
    }

    return input.toUpperCase().trim();
  };

  const getAssetUnitLabel = (name: string): string => {
    const lower = name.trim().toLowerCase();
    
    if (lower === 'nakit' || lower === 'tl') return '₺';
    if (lower === 'yk') return '₺';
    
    const mapping: Record<string, string> = {
      // Dolar
      'dolar': '$',
      'usd': '$',
      'cad': 'C$',
      'aud': 'A$',
      // Euro
      'euro': '€',
      'eur': '€',
      // Pound / Sterlin
      'gbp': '£',
      'sterlin': '£',
      // Riyal
      'sar': '﷼',
      'riyali': '﷼',
      'riyal': '﷼',
      'qar': '﷼',
      // Syrian Pound
      'syp': 'ل.س',
      'suriye lirası': 'ل.س',
      // BAM / KM
      'bam': 'KM',
      // Franc
      'chf': '₣',
      'frank': '₣',
      // Ruble
      'rub': '₽',
      'ruble': '₽',
      // Yen / Yuan
      'jpy': '¥',
      'yen': '¥',
      'cny': '¥',
      'yuan': '¥',
      // Dirham
      'aed': 'د.إ',
      'dirhem': 'د.إ',
      // Dinar
      'kwd': 'د.k',
      'dinar': 'د.k',
      'iqd': 'د.ع',
      // Kron
      'sek': 'kr',
      'nok': 'kr',
      'dkk': 'kr',
      // Manat
      'azn': '₼',
      'manat': '₼',
      // Grivna
      'uah': '₴',
      // Rupi
      'inr': '₹',
      // EGP
      'egp': 'E£',
      // Won
      'krw': '₩',
      
      // Gold types
      'gram': 'Gram',
      'çeyrek': 'Çeyrek',
      'yarım': 'Yarım',
      'tam': 'Tam',
      'ata': 'Ata',
      'lira': 'Lira',
    };
    
    if (mapping[lower]) return mapping[lower];
    
    // No longer forcing uppercase for short names
    if (name.length >= 3 && name.length <= 4 && name === name.toUpperCase()) {
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
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
  const [goldTransactionType, setGoldTransactionType] = useDraftState<'Birikim' | 'Bozdurma'>('daily_draft_gold_tx_type', 'Birikim');

  // Exchange Form State
  const [showExchangeForm, setShowExchangeForm] = useState(false);
  const [exchangeFromType, setExchangeFromType] = useState('NAKIT');
  const [exchangeToType, setExchangeToType] = useState('NAKIT');
  const [exchangeFromAmount, setExchangeFromAmount] = useState('');
  const [exchangeToAmount, setExchangeToAmount] = useState('');
  const [exchangeDate, setExchangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeNote, setExchangeNote] = useState('');
  const [exchangeFromCustomCode, setExchangeFromCustomCode] = useState('');
  const [exchangeToCustomCode, setExchangeToCustomCode] = useState('');

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
        // The user wants the TL equivalent to be added to the vault note to help with matching
        // "Altın alış satış da TL karşılığını yazıyorum ya bunu kasa kısmında nota eklersen..."
        const finalVaultNote = goldPriceTL ? `${goldNote ? goldNote + ' | ' : ''}${goldTransactionType === 'Bozdurma' ? 'Satış' : 'Alış'} Fiyatı: ${goldPriceTL} TL` : goldNote;

        // 1. Add to Vault only!
        await addVaultRecord({
          record_date: date,
          owner: goldOwner,
          gold_type: type,
          amount: numAmount,
          note: finalVaultNote,
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
        finalType = detectCurrencyCode(customCurrencyCode);
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
              transaction_type: isExpense ? 'Bozdurma' : 'Birikim',
              gold_type: finalType
            });
          }
        } else {
          const originalExpense = activeExpenses.find(ex => ex.id === editingId);
          if (originalExpense) {
            const descStr = originalExpense.description || '';
            // Make the trailing part lazy and allow any characters after it, but we need to know the goldType exactly.
            // Since there's no FK, we will look up by what the original description started with.
            // But goldType might contain spaces. It's safer to just match it loosely and then let find() do the exact match if needed.
            // Wait, the review said: "if a user edits the description to append a simple note ... the regex will extract ... as the gold type."
            // So we should extract just the known active currency/gold types. But we don't have them in scope here easily.
            // We can match up to the first space or hyphen if needed, but goldType could be "Ata Altın".
            // A better regex: match exactly what was generated by checking if the description starts with the pattern, and then checking against known vaultRecords to find a match.
            const matchGoldAlimSatis = descStr.match(/^Altın (Alımı|Satışı):\s+([\d.]+)\s+([^|\-(]+)/); // Stop at first pipe, hyphen, or parenthesis if they added a note

            if (matchGoldAlimSatis) {
              const goldAmount = parseFloat(matchGoldAlimSatis[2]);
              const goldType = matchGoldAlimSatis[3].trim();

              if (!isNaN(goldAmount) && goldType) {
                const vaultMatch = vaultRecords.find(r =>
                  r.gold_type === goldType &&
                  Number(r.amount) === goldAmount &&
                  r.record_date === originalExpense.date
                );

                if (vaultMatch && vaultMatch.id) {
                  // If they changed the description, maybe they changed the gold amount
                  let newGoldAmount = vaultMatch.amount;
                  let newGoldType = vaultMatch.gold_type;
                  const newMatchGold = description.match(/^Altın (Alımı|Satışı):\s+([\d.]+)\s+([^|\-(]+)/);
                  if (newMatchGold) {
                    newGoldAmount = parseFloat(newMatchGold[2]);
                    newGoldType = newMatchGold[3].trim();
                  }

                  await updateVaultRecord(vaultMatch.id, {
                    ...vaultMatch,
                    record_date: date,
                    amount: !isNaN(newGoldAmount) ? newGoldAmount : vaultMatch.amount,
                    gold_type: newGoldType || vaultMatch.gold_type,
                    note: description !== originalExpense.description ? description : vaultMatch.note
                  });
                }
              }
            }
          }

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

  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fAmount = parseFloat(exchangeFromAmount);
    const tAmount = parseFloat(exchangeToAmount);

    if (isNaN(fAmount) || fAmount <= 0 || isNaN(tAmount) || tAmount <= 0) {
      return; // Invalid amounts
    }

    let finalFromType = exchangeFromType;
    if (finalFromType === 'NEW_CURRENCY') {
      if (!exchangeFromCustomCode) return;
      finalFromType = detectCurrencyCode(exchangeFromCustomCode);
    }

    let finalToType = exchangeToType;
    if (finalToType === 'NEW_CURRENCY') {
      if (!exchangeToCustomCode) return;
      finalToType = detectCurrencyCode(exchangeToCustomCode);
    }

    if (finalFromType === finalToType) return; // Same type, ignore

    const note = exchangeNote.trim() ? ` - ${exchangeNote}` : '';
    const fDesc = `Dönüşüm Çıkışı: ${fAmount} ${finalFromType} -> ${tAmount} ${finalToType}${note}`;
    const tDesc = `Dönüşüm Girişi: ${fAmount} ${finalFromType} -> ${tAmount} ${finalToType}${note}`;

    // Deduct from `exchangeFromType`
    addDailyExpense({
      date: exchangeDate,
      description: fDesc,
      amount: -fAmount,
      type: finalFromType
    });

    if (isGoldType(finalFromType)) {
      await addVaultRecord({
        record_date: exchangeDate,
        owner: 'Ortak',
        amount: fAmount,
        note: fDesc,
        transaction_type: 'Bozdurma',
        gold_type: finalFromType
      });
    }

    // Add to `exchangeToType`
    addDailyExpense({
      date: exchangeDate,
      description: tDesc,
      amount: tAmount,
      type: finalToType
    });

    if (isGoldType(finalToType)) {
      await addVaultRecord({
        record_date: exchangeDate,
        owner: 'Ortak',
        amount: tAmount,
        note: tDesc,
        transaction_type: 'Birikim',
        gold_type: finalToType
      });
    }

    setShowExchangeForm(false);
    setExchangeFromAmount('');
    setExchangeToAmount('');
    setExchangeNote('');
    setExchangeFromCustomCode('');
    setExchangeToCustomCode('');
    setActiveTab(finalToType);
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
      } else {
        // Check if this is an auto-generated TL expense from Gold Purchase/Sale
        const descStr = expense.description || '';
        const matchGoldAlimSatis = descStr.match(/^Altın (Alımı|Satışı):\s+([\d.]+)\s+([^|\-(]+)/);

        if (matchGoldAlimSatis) {
          const goldAmount = parseFloat(matchGoldAlimSatis[2]);
          const goldType = matchGoldAlimSatis[3].trim();

          if (!isNaN(goldAmount) && goldType) {
            const vaultMatch = vaultRecords.find(r =>
              r.gold_type === goldType &&
              Number(r.amount) === goldAmount &&
              r.record_date === expense.date
            );
            if (vaultMatch && vaultMatch.id) {
              await deleteVaultRecord(vaultMatch.id);
            }
          }
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

  const assetOptions = (
    <>
      <option value="NAKIT">Türk Lirası</option>
      {showMealCard && <option value="YK">Yemek Kartı</option>}
      {activeCurrencies.map(curr => (<option key={curr} value={curr}>{getAssetFullTitle(curr)}</option>))}
      <option value="NEW_CURRENCY">+ Diğer Para Birimi Ekle...</option>
    </>
  );

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
        <div className="space-y-4">
          <div className="flex gap-2">
             <button
                onClick={() => setShowExchangeForm(false)}
                className={cn(
                   "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                   !showExchangeForm ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
             >
                Normal İşlem
             </button>
             <button
                onClick={() => setShowExchangeForm(true)}
                className={cn(
                   "flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2",
                   showExchangeForm ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
             >
                <ArrowRightLeft size={16} /> Döviz/Altın Dönüştür
             </button>
          </div>

        {showExchangeForm ? (
          <Card title="Varlık Dönüştür (Takas)">
            <form onSubmit={handleExchangeSubmit} className="space-y-3 mt-2">
              <div className="flex gap-2 items-center">
                <div className="flex-[2] space-y-1">
                   <label className="text-xs text-muted-foreground">Verilen Birim</label>
                   <select value={exchangeFromType} onChange={e => setExchangeFromType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary">
                     <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                     <optgroup label="Altın Türleri">
                       {allFormTypes.golds.map(gold => (<option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>))}
                     </optgroup>
                   </select>
                </div>
                <div className="flex-1 space-y-1">
                   <label className="text-xs text-muted-foreground">Tutar</label>
                   <input type="number" step="0.001" required placeholder="0.00" value={exchangeFromAmount} onChange={e => setExchangeFromAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {exchangeFromType === 'NEW_CURRENCY' && (
                 <div className="space-y-1 mb-2">
                   <label className="text-xs text-muted-foreground">Yeni Verilen Para Birimi Adı (Örn: Dolar)</label>
                   <input type="text" required placeholder="Para Birimi Girin" value={exchangeFromCustomCode} onChange={e => setExchangeFromCustomCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary font-medium" />
                 </div>
              )}

              <div className="flex justify-center text-muted-foreground py-1">
                <ArrowRightLeft size={20} className="rotate-90" />
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex-[2] space-y-1">
                   <label className="text-xs text-muted-foreground">Alınan Birim</label>
                   <select value={exchangeToType} onChange={e => setExchangeToType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary">
                     <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                     <optgroup label="Altın Türleri">
                       {allFormTypes.golds.map(gold => (<option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>))}
                     </optgroup>
                   </select>
                </div>
                <div className="flex-1 space-y-1">
                   <label className="text-xs text-muted-foreground">Tutar</label>
                   <input type="number" step="0.001" required placeholder="0.00" value={exchangeToAmount} onChange={e => setExchangeToAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {exchangeToType === 'NEW_CURRENCY' && (
                 <div className="space-y-1 mt-1 mb-2">
                   <label className="text-xs text-muted-foreground">Yeni Alınan Para Birimi Adı (Örn: Dolar)</label>
                   <input type="text" required placeholder="Para Birimi Girin" value={exchangeToCustomCode} onChange={e => setExchangeToCustomCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary font-medium" />
                 </div>
              )}

              <div className="flex gap-2">
                 <div className="flex-[2] space-y-1">
                    <label className="text-xs text-muted-foreground">Açıklama / Kur Bilgisi (İsteğe Bağlı)</label>
                    <input type="text" placeholder="Örn: 1 Dolar = 35 TL" value={exchangeNote} onChange={e => setExchangeNote(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                 </div>
                 <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Tarih</label>
                    <input type="date" value={exchangeDate} onChange={e => setExchangeDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary focus:ring-2 focus:ring-primary" />
                 </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Dönüştür
              </button>
            </form>
          </Card>
        ) : (
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
                    {assetOptions}
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
                <label className="text-xs text-muted-foreground">Yeni Para Birimi Adı, Sembolü veya Kodu (Örn: Dolar, $, Euro, €)</label>
                <input
                  type="text"
                  required
                  placeholder="Para Birimi Girin (Örn: Dolar, $, Euro)"
                  value={customCurrencyCode}
                  onChange={(e) => setCustomCurrencyCode(e.target.value)}
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
        )}
        </div>
      ) : (
        <div className="text-center p-4 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Planlama modundasınız. Gelecek aylar için günlük harcama girilemez, sadece sabit gider planlaması yapılabilir.
        </div>
      )}

      {viewDate <= state.currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title={`${isGoldType(activeTab) ? 'Toplam Birikim' : 'Bu Ay Harcanan'} (${getAssetFullTitle(activeTab)})`} className={`${isGoldType(activeTab) ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className={`text-2xl font-bold mt-2 ${isGoldType(activeTab) ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-500'}`}>
                 {isGoldType(activeTab) ? (currentMonthIncome - currentMonthSpent).toLocaleString('tr-TR') : currentMonthSpent.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}
              </div>
            </Card>
            <Card title={`Bu Ayki Gelir / Giriş (${getAssetFullTitle(activeTab)})`} className="bg-green-500/5 border-green-500/20">
              <div className="text-2xl font-bold text-green-500 mt-2">
                 {currentMonthIncome.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}
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
                 {dailyTotal > 0 ? '+' : ''}{dailyTotal.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}
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
                      {expense.amount.toLocaleString('tr-TR')}{isGoldType(expense.type) ? ' ' : ''}{getAssetUnitLabel(expense.type)}
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
            {getAssetFullTitle(activeTab)} için kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}
