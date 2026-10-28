import { useDraftState } from '../hooks/useDraftState';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import type { DailyExpense } from '../types';
import { Card } from '../components/ui/Card';
import { Trash2, Banknote, CreditCard, Pencil, X, ArrowRightLeft, CheckCircle, Circle, Wallet, AlertTriangle, Check } from 'lucide-react';
import { MonthNavigator } from '../components/MonthNavigator';
import { format } from 'date-fns';
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { tr } from 'date-fns/locale';
import { cn, scrollToElement, scrollToSearchKey, getTodayStr } from '../lib/utils';
import { searchKeyFor } from '../lib/search';
import { SearchTrigger } from '../components/SearchTrigger';
import { PrivacyTrigger } from '../components/PrivacyTrigger';
import { Secret } from '../components/Secret';
import { SpendingCalendar } from '../components/SpendingCalendar';
import { useSelectMode } from '../hooks/useSelectMode';
import { SelectionBar } from '../components/SelectionBar';
import { useLocation, useNavigate } from 'react-router-dom';

const billColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#06b6d4'];

// Bir dailyExpense OTOMATIK uretilmis bir alim/satis/takas (ya da kasa) kaydi mi, yoksa
// kullanicinin serbest yazdigi DOGRUDAN harcama/gelir mi? (bayrak yok; imza tabanli.)
// true => Doviz-Altin dunyasi; false => Normal (dogrudan harcama/gelir).
const EXCHANGE_KUR = /\(Kur:/;                                // tum takas alim/satis bacaklari kur notu tasir
const EXCHANGE_TAKAS = /\(Takas\)/;                           // doviz<->doviz takas eki
const EXCHANGE_DONUSUM = /^Dönüşüm (Çıkışı|Girişi):/;         // fallback (nakit<->nakit; pratikte olusmaz)
const EXCHANGE_TLLEG = /^(Altın|Döviz) (Alımı|Satışı):\s*\d/; // TL-maliyet bacagi (type=NAKIT; kur notu olmayabilir)
const isExchangeEntry = (e: DailyExpense): boolean => {
  if (typeof e.id === 'string' && e.id.startsWith('vault-curr-')) return true;
  const d = (e.description || '').trim();
  if (!d) return false;
  // Takas bacaklari DAIMA "(Kur: ...)" ya da "(Takas)" tasir -> kullanicinin serbest yazdigi
  // "3 Kitap Alımı" gibi gercek bir harcama yanlislikla alim sanilmaz. TL-maliyet bacagi ise
  // "Altın/Döviz Alımı: N" imzasindan yakalanir.
  return EXCHANGE_KUR.test(d) || EXCHANGE_TAKAS.test(d) || EXCHANGE_DONUSUM.test(d) || EXCHANGE_TLLEG.test(d);
};

// Bir kaydin aktif (alt-sekme + varlik sekmesi) gorunumune girip girmedigi. Liste VE ozet
// kartlari AYNI suzgeci kullansin (uyumlu kalsinlar) diye tek kaynak. NORMAL/doviz: yalniz
// dogrudan harcama/gelir; NORMAL/TL(NAKIT),YK: hepsi; DOVIZ-ALTIN: yalniz alim/satis/takas.
// Gelecek-ayda suzgec yok.
const passesSubTabFilter = (e: DailyExpense, activeTab: string, activeSubTab: string, isFuture: boolean): boolean => {
  if (e.type !== activeTab) return false;
  if (isFuture) return true;
  if (activeSubTab === 'NORMAL') {
    if (activeTab !== 'NAKIT' && activeTab !== 'YK') return !isExchangeEntry(e);
    return true;
  }
  if (activeSubTab === 'EXCHANGE') return isExchangeEntry(e);
  return true;
};

export default function DailyExpenses() {
  const {
    state,
    viewDate,
    setViewDate,
    addDailyExpense,
    updateDailyExpense,
    deleteDailyExpense,
    showMealCard,
    vaultRecords,
    addVaultRecord,
    updateVaultRecord,
    deleteVaultRecord,
    resolveGoldOwner,
    activeCurrencies,
    askConfirmation,
    addFixedExpense,
    updateFixedExpense,
    toggleFixedExpense,
    addCustomIncome,
    deleteFixedExpense,
    deleteCustomIncome,
    dueBillsCount,
    autoPaidBills,
    autoPaidBillsCount,
    dismissAutoPaidBill,
    todayStr,
    creditCards
  } = useBudget();
  const { username } = useAuth();

  const getLocalMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const isFuture = viewDate > getLocalMonth();



  const currentMonthBills = useMemo(() => {
    const list = (state.fixedExpenses || []).filter(e => e.isBill && e.type !== 'PLANNED_VAULT');
    return [...list].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return a.title.localeCompare(b.title, 'tr');
    });
  }, [state.fixedExpenses]);

  const groupedBills = useMemo(() => {
    const groups: Record<string, typeof currentMonthBills> = {};
    const noDateGroup: typeof currentMonthBills = [];

    currentMonthBills.forEach(bill => {
      if (bill.date) {
        if (!groups[bill.date]) {
          groups[bill.date] = [];
        }
        groups[bill.date].push(bill);
      } else {
        noDateGroup.push(bill);
      }
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return { groups, noDateGroup, sortedKeys };
  }, [currentMonthBills]);

  const totalBillsAmount = useMemo(() => {
    return currentMonthBills.reduce((sum, e) => sum + e.amount, 0);
  }, [currentMonthBills]);

  const paidBillsAmount = useMemo(() => {
    return currentMonthBills.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  }, [currentMonthBills]);

  const unpaidBillsAmount = useMemo(() => {
    return currentMonthBills.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  }, [currentMonthBills]);



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
      // Cok kelimeli bilezik adlari (ör. "22 Ayar Bilezik", "Ajda Bilezik") oldugu gibi gorunsun;
      // yoksa asagidaki yedek sona " Altın" ekleyip "22 Ayar Bilezik Altın" gibi yapardi.
      if (lower.includes('bilezik')) return name;
      return `${name} Altın`;
    }

    // Currency types
    const mapping: Record<string, string> = {
      'nakit': 'TL',
      'tl': 'TL',
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
      'lbp': 'Lübnan Lirası',
      'lübnan lirası': 'Lübnan Lirası',
      'uzs': 'Özbekistan Somu',
      'özbekistan somu': 'Özbekistan Somu',
      'irr': 'İran Riyali',
      'iran riyali': 'İran Riyali',
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
    
    // İran, 'riyal' içerdiği için SAR'dan ÖNCE kontrol edilmeli.
    if (lowerInput.includes('iran') || lowerInput === 'irr') {
      return 'IRR';
    }

    if (lowerInput.includes('lubnan') || lowerInput === 'lbp') {
      return 'LBP';
    }

    if (lowerInput.includes('ozbek') || lowerInput === 'uzs' || lowerInput === 'som') {
      return 'UZS';
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
      // Lübnan / Özbekistan / İran
      'lbp': 'L£',
      'lübnan lirası': 'L£',
      'uzs': "so'm",
      'özbekistan somu': "so'm",
      'irr': '﷼',
      'iran riyali': '﷼',
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
    const defaultGolds = ["Gram", "Çeyrek", "Yarım", "Tam", "Ata Lira", "22 Ayar Bilezik", "Ajda Bilezik"];
    const recordsGolds = vaultRecords
      .map(r => r.gold_type)
      .filter(t => isGoldType(t));
    const allGolds = Array.from(new Set([...defaultGolds, ...recordsGolds]));
    return {
      currencies: ['NAKIT', ...(showMealCard ? ['YK'] : []), ...activeCurrencies],
      golds: allGolds
    };
  }, [showMealCard, activeCurrencies, vaultRecords]);

  const [date, setDate] = useDraftState('daily_draft_date', getTodayStr());
  const [description, setDescription] = useDraftState('daily_draft_desc', '');
  const [amount, setAmount] = useDraftState('daily_draft_amount', '');
  const [type, setType] = useDraftState<string>('daily_draft_type', 'NAKIT');
  const [transactionType, setTransactionType] = useDraftState<'INCOME' | 'EXPENSE'>('daily_draft_tx_type', 'EXPENSE');
  const [activeTab, setActiveTab] = useDraftState<string>('daily_draft_tab', 'NAKIT');
  // Sekme (aktif varlık) degisince formdaki "Varlik / Para Birimi" (type) de ona
  // esitlensin: YK sekmesine gecince form otomatik YK, Dolar'da Dolar... Mount'ta da
  // calistigi icin Bilanco'dan kaydirmayla gelisi ve manuel sekme secimini kapsar.
  useEffect(() => {
    setType(activeTab);
  }, [activeTab, setType]);
  const [editingId, setEditingId] = useDraftState<string | null>('daily_draft_editing_id', null);
  const [customCurrencyCode, setCustomCurrencyCode] = useState('');

  const [goldOwner, setGoldOwner] = useDraftState('daily_draft_gold_owner', '');
  const [goldNote, setGoldNote] = useDraftState('daily_draft_gold_note', '');
  const [goldPriceTL, setGoldPriceTL] = useDraftState('daily_draft_gold_price_tl', '');
  const [goldTransactionType, setGoldTransactionType] = useDraftState<'Birikim' | 'Bozdurma'>('daily_draft_gold_tx_type', 'Birikim');

  // Altin "Kime Ait": yazilan ad kayitli bir kullaniciysa emanet. Anlik onay satiri icin
  // debounce'li kontrol (yalniz backend'e sorar; ben miyim / kullanici mi).
  const [ownerCheck, setOwnerCheck] = useState<{ isUser: boolean; isSelf: boolean } | null>(null);
  useEffect(() => {
    const name = goldOwner.trim();
    if (!name) { setOwnerCheck(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      resolveGoldOwner(name).then(r => { if (!cancelled) setOwnerCheck(r); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [goldOwner]);
  // Varsayilan sahip = kendi kullanici adim (bir kez, alan bossa; kullanici adi yuklenince).
  const ownerPrefilledRef = useRef(false);
  useEffect(() => {
    if (ownerPrefilledRef.current || !username) return;
    ownerPrefilledRef.current = true;
    if (!goldOwner.trim()) setGoldOwner(username);
  }, [username]);

  const [activeSubTab, setActiveSubTab] = useState<'NORMAL' | 'EXCHANGE' | 'BILLS'>('NORMAL');
  // Basili tutarak coklu secim modu (liste kalemlerinin net toplamini alttan gosterir).
  const sel = useSelectMode();
  // Baska sekme/para birimine ya da baska aya gecince secim modundan cik.
  useEffect(() => { sel.exit(); }, [activeSubTab, activeTab, viewDate, sel.exit]);
  // Tarih barina cift tiklama gunluk liste yerine takvim gorunumunu acar/kapatir (bu sayfaya ozel).
  const [showCalendar, setShowCalendar] = useState(false);
  // "Yeni İşlem Ekle" formu acilir-kapanir (cihaz-bazli tercih; VARSAYILAN KAPALI; duzenlerken zorla acik).
  const [addFormOpen, setAddFormOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('daily_addform_open') === 'true'; } catch { return false; }
  });
  const toggleAddForm = () => setAddFormOpen(o => {
    const n = !o;
    try { localStorage.setItem('daily_addform_open', String(n)); } catch { /* yoksay */ }
    return n;
  });
  // Doviz/Altin "Varlik Donustur" formu acilir-kapanir (varsayilan kapali; duzenlerken zorla acik).
  const [exchangeFormOpen, setExchangeFormOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('daily_exchangeform_open') === 'true'; } catch { return false; }
  });
  const toggleExchangeForm = () => setExchangeFormOpen(o => {
    const n = !o;
    try { localStorage.setItem('daily_exchangeform_open', String(n)); } catch { /* yoksay */ }
    return n;
  });
  // Faturalar "Yeni Fatura Ekle" formu acilir-kapanir (varsayilan kapali; duzenlerken zorla acik).
  const [billFormOpen, setBillFormOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('daily_billform_open') === 'true'; } catch { return false; }
  });
  const toggleBillForm = () => setBillFormOpen(o => {
    const n = !o;
    try { localStorage.setItem('daily_billform_open', String(n)); } catch { /* yoksay */ }
    return n;
  });
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPaymentMethod, setBillPaymentMethod] = useState<'NAKIT' | 'KK'>('NAKIT');
  // KK odemeli faturanin dogacagi kart borcunun yazilacagi kredi karti.
  const [billCardId, setBillCardId] = useState<string>('');
  const [billDate, setBillDate] = useState(() => getTodayStr());
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [exchangeTabMode, setExchangeTabMode] = useState<'CURRENCY' | 'GOLD'>('CURRENCY');
  const [exchangeFromType, setExchangeFromType] = useState('NAKIT');
  const [exchangeToType, setExchangeToType] = useState('NAKIT');
  const [exchangeFromAmount, setExchangeFromAmount] = useState('');
  const [exchangeToAmount, setExchangeToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  // Doviz/Altin takasi da diger sekmeler gibi paylasilan 'date' (tarih secici) kullanir
  // (eskiden sabit getTodayStr() idi -> tarih secilemiyordu).
  const exchangeDate = date;
  const [exchangeNote, setExchangeNote] = useState('');
  const [exchangeFromCustomCode, setExchangeFromCustomCode] = useState('');
  const [exchangeToCustomCode, setExchangeToCustomCode] = useState('');

  // Alt-sekme basina AYRI sekme hafizasi. activeTab (daily_draft_tab) NORMAL'in efektif sekmesi
  // olarak KALIR (dis yazicilar degismez: Bilanco TL/YK kartlari + arama deep-link). Doviz/Altin
  // kendi son sekmesini ayri bir ref'te tutar; boylece orada doviz secmek NORMAL'e SIZMAZ.
  const normalTabRef = useRef(activeTab);
  const exchangeTabRef = useRef<string | null>(null);
  // Doviz/Altin (EXCHANGE) sekmesinden baslatilan bir DUZENLEME formu yalniz NORMAL'de
  // render edildigi icin oraya gecer; kaydet/iptal sonrasi kullaniciyi geldigi alt-sekmeye
  // geri dondurmek icin hangi sekmeden gelindigini burada tutariz (null = NORMAL'den gelindi).
  const editReturnSubTabRef = useRef<'NORMAL' | 'EXCHANGE' | 'BILLS' | null>(null);
  // Aktif alt-sekmenin efektif sekmesini kendi hafizasina yaz (YALNIZ ref -> setState yok, dongu yok).
  useEffect(() => {
    if (activeSubTab === 'NORMAL') normalTabRef.current = activeTab;
    else if (activeSubTab === 'EXCHANGE') exchangeTabRef.current = activeTab;
  }, [activeTab, activeSubTab]);
  // Alt-sekme degistirici: hedefin hatirlanan sekmesini geri yukler. NORMAL daima geri yuklenir;
  // EXCHANGE yalniz onceden bir sekme hatirlandiysa (ilk seferde fallback availableTabs[0]'i secer).
  // BILLS activeTab kullanmaz -> dokunulmaz.
  const switchSubTab = (target: 'NORMAL' | 'EXCHANGE' | 'BILLS') => {
    if (target !== activeSubTab) {
      // Baska alt-sekmeye gecince ACIK DUZENLEME iptal (kullanici sekme degistirdi).
      // NOT: handleEdit'in programatik setActiveSubTab'i bu fonksiyondan gecmez -> yeni
      // baslatilan duzenlemeyi iptal etmez.
      if (editingId) cancelEdit();
      if (editingBillId) handleCancelEditBill();
      // Kullanici sekmeyi ELLE degistirdi -> duzenleme-donus hedefini unut (aksi halde
      // sonraki kaydet/iptal kullaniciyi istemedigi sekmeye geri atar).
      editReturnSubTabRef.current = null;
      if (target === 'NORMAL') setActiveTab(normalTabRef.current || 'NAKIT');
      else if (target === 'EXCHANGE' && exchangeTabRef.current) setActiveTab(exchangeTabRef.current);
    }
    setActiveSubTab(target);
  };

  // --- Global arama deep-link tuketimi ---
  // Layout'un pathname scroll-reset useLayoutEffect'inden SONRA calissin diye useEffect (+rAF).
  const dlLocation = useLocation();
  const dlNavigate = useNavigate();
  useEffect(() => {
    const dl = (dlLocation.state as { deepLink?: { key?: string; subTab?: 'NORMAL' | 'EXCHANGE' | 'BILLS' | null; exchangeMode?: 'CURRENCY' | 'GOLD' | null; assetTab?: string | null } } | null)?.deepLink;
    if (!dl || !dl.key) return;
    if (dl.subTab) setActiveSubTab(dl.subTab);
    if (dl.exchangeMode) setExchangeTabMode(dl.exchangeMode);
    if (dl.assetTab) setActiveTab(dl.assetTab);
    scrollToSearchKey(dl.key);
    dlNavigate(dlLocation.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlLocation.key]);

  const calculatedExchangeRate = useMemo(() => {
    const fromAmt = parseFloat(exchangeFromAmount);
    const toAmt = parseFloat(exchangeToAmount);
    if (isNaN(fromAmt) || fromAmt <= 0 || isNaN(toAmt) || toAmt <= 0) return null;

    let fromType = exchangeFromType;
    if (fromType === 'NEW_CURRENCY' && exchangeFromCustomCode) {
      fromType = detectCurrencyCode(exchangeFromCustomCode);
    }
    let toType = exchangeToType;
    if (toType === 'NEW_CURRENCY' && exchangeToCustomCode) {
      toType = detectCurrencyCode(exchangeToCustomCode);
    }

    if (fromType === 'NAKIT' && toType !== 'NAKIT') {
      const rate = fromAmt / toAmt;
      return `Birim Fiyat: 1 ${toType} = ${rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL`;
    } else if (fromType !== 'NAKIT' && toType === 'NAKIT') {
      const rate = toAmt / fromAmt;
      return `Birim Fiyat: 1 ${fromType} = ${rate.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL`;
    } else {
      const rate1 = toAmt / fromAmt;
      const rate2 = fromAmt / toAmt;
      return `Birim Fiyat: 1 ${fromType} = ${rate1.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${toType} | 1 ${toType} = ${rate2.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${fromType}`;
    }
  }, [exchangeFromAmount, exchangeToAmount, exchangeFromType, exchangeToType, exchangeFromCustomCode, exchangeToCustomCode]);

  const calculatedGoldUnitPrice = useMemo(() => {
    const total = parseFloat(goldPriceTL);
    const qty = parseFloat(amount);
    if (isNaN(total) || total <= 0 || isNaN(qty) || qty <= 0) return '-';
    return (total / qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  }, [goldPriceTL, amount]);

  const formatRateValue = (val: number): string => {
    if (isNaN(val) || val <= 0) return '';
    return val % 1 === 0 ? val.toFixed(0) : parseFloat(val.toFixed(2)).toString();
  };

  useEffect(() => {
    const fAmt = parseFloat(exchangeFromAmount);
    const tAmt = parseFloat(exchangeToAmount);
    if (!isNaN(fAmt) && fAmt > 0 && !isNaN(tAmt) && tAmt > 0) {
      if (exchangeFromType === 'NAKIT') {
        setExchangeRate(formatRateValue(fAmt / tAmt));
      } else if (exchangeToType === 'NAKIT') {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      } else {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      }
    } else {
      setExchangeRate('');
    }
  }, [exchangeFromType, exchangeToType]);

  const handleFromAmountChange = (val: string) => {
    setExchangeFromAmount(val);
    const fAmt = parseFloat(val);
    const tAmt = parseFloat(exchangeToAmount);
    if (!isNaN(fAmt) && fAmt > 0 && !isNaN(tAmt) && tAmt > 0) {
      if (exchangeFromType === 'NAKIT') {
        setExchangeRate(formatRateValue(fAmt / tAmt));
      } else if (exchangeToType === 'NAKIT') {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      } else {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      }
    }
  };

  const handleToAmountChange = (val: string) => {
    setExchangeToAmount(val);
    const fAmt = parseFloat(exchangeFromAmount);
    const tAmt = parseFloat(val);
    if (!isNaN(fAmt) && fAmt > 0 && !isNaN(tAmt) && tAmt > 0) {
      if (exchangeFromType === 'NAKIT') {
        setExchangeRate(formatRateValue(fAmt / tAmt));
      } else if (exchangeToType === 'NAKIT') {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      } else {
        setExchangeRate(formatRateValue(tAmt / fAmt));
      }
    }
  };

  const handleExchangeRateChange = (val: string) => {
    setExchangeRate(val);
    const rate = parseFloat(val);
    if (isNaN(rate) || rate <= 0) return;

    const fAmt = parseFloat(exchangeFromAmount);
    const tAmt = parseFloat(exchangeToAmount);

    if (exchangeFromType === 'NAKIT') {
      if (!isNaN(tAmt) && tAmt > 0) {
        setExchangeFromAmount((tAmt * rate).toFixed(2));
      } else if (!isNaN(fAmt) && fAmt > 0) {
        setExchangeToAmount((fAmt / rate).toFixed(2));
      }
    } else if (exchangeToType === 'NAKIT') {
      if (!isNaN(fAmt) && fAmt > 0) {
        setExchangeToAmount((fAmt * rate).toFixed(2));
      } else if (!isNaN(tAmt) && tAmt > 0) {
        setExchangeFromAmount((tAmt / rate).toFixed(2));
      }
    } else {
      if (!isNaN(fAmt) && fAmt > 0) {
        setExchangeToAmount((fAmt * rate).toFixed(2));
      } else if (!isNaN(tAmt) && tAmt > 0) {
        setExchangeFromAmount((tAmt / rate).toFixed(2));
      }
    }
  };

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
    if (viewDate === state.currentMonth) {
      return state.dailyExpenses;
    }

    const plans: DailyExpense[] = [];
    
    // 1. Sabit Giderler altındaki PLANNED_VAULT (altın/döviz) planları ve NAKIT/YK sabit gider planları
    (state.fixedExpenses || []).forEach(e => {
      if (e.type === 'PLANNED_VAULT') {
        if (e.vault_gold_type === activeTab) {
          const isSale = e.title?.toLowerCase().includes('satış') || e.title?.toLowerCase().includes('bozdurma');

          plans.push({
            id: e.id,
            date: `${viewDate}-01`,
            description: e.title || 'Planlanan Birikim',
            amount: isSale ? -(e.vault_amount || 0) : (e.vault_amount || 0),
            type: e.vault_gold_type
          });
        }
      } else {
        const expenseType = e.type || 'NAKIT';
        if (expenseType === activeTab) {
          if (expenseType === 'NAKIT' && e.paymentMethod === 'KK') {
            return;
          }
          plans.push({
            id: e.id,
            date: `${viewDate}-01`,
            description: e.title,
            amount: -e.amount,
            type: expenseType
          });
        }
      }
    });

    // 2. Custom Gelir Planları
    (state.customIncomes || []).forEach(e => {
      const incomeType = e.type || 'NAKIT';
      if (incomeType === activeTab) {
        plans.push({
          id: e.id,
          date: `${viewDate}-01`,
          description: e.title,
          amount: e.amount,
          type: incomeType
        });
      }
    });

    return plans;
  }, [viewDate, state.currentMonth, state.history, state.dailyExpenses, state.fixedExpenses, state.customIncomes, activeTab]);

  const availableTabs = useMemo(() => {
    if (activeSubTab === 'NORMAL') {
      // Normal'de bir doviz sekmesi ancak o dovizde DOGRUDAN bir islem (harcama/gelir) varsa
      // gorunur; yalniz alim (takas) yapildiysa Normal'de sekme cikmaz (o Doviz-Altin'a ait).
      const cur = isFuture
        ? activeCurrencies
        : activeCurrencies.filter(c => activeExpenses.some(e => passesSubTabFilter(e, c, 'NORMAL', isFuture)));
      return ['NAKIT', ...(showMealCard ? ['YK'] : []), ...cur];
    }
    if (activeSubTab === 'EXCHANGE') {
      // Doviz-Altin'da bir doviz sekmesi ancak o dovizde alim/satis/takas varsa gorunur.
      return isFuture
        ? activeCurrencies
        : activeCurrencies.filter(c => activeExpenses.some(e => passesSubTabFilter(e, c, 'EXCHANGE', isFuture)));
    }
    return [];
  }, [showMealCard, activeCurrencies, activeExpenses, activeSubTab, isFuture]);

  // Doviz/Altin (EXCHANGE) GOLD modunda cip-sekmeler: o ay HAREKETI olan altin turleri.
  // availableTabs (yalniz dovizler) KORUNUR -> tum efektler onu kullanmaya devam eder, boylece
  // altin-modu senkron efektiyle "sekme titremesi/sonsuz dongu" riskine HIC girilmez.
  const activeGoldTypes = useMemo(() => {
    const set = new Set<string>();
    if (isFuture) {
      (state.fixedExpenses || []).forEach(e => {
        if (e.type === 'PLANNED_VAULT' && e.vault_gold_type && isGoldType(e.vault_gold_type)) set.add(e.vault_gold_type);
      });
    } else {
      (vaultRecords || []).forEach(r => {
        if (r && r.gold_type && isGoldType(r.gold_type) && typeof r.record_date === 'string' && r.record_date.slice(0, 7) === viewDate) set.add(r.gold_type);
      });
      activeExpenses.forEach(e => { if (isGoldType(e.type)) set.add(e.type); });
    }
    return Array.from(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFuture, state.fixedExpenses, vaultRecords, viewDate, activeExpenses]);

  // Cip-cubugu kaynagi: GOLD modunda altin turleri, aksi halde dovizler (availableTabs).
  const exchangeTabChips = (activeSubTab === 'EXCHANGE' && exchangeTabMode === 'GOLD') ? activeGoldTypes : availableTabs;

  // Yalniz sayfa ACILISINDA (mount/donus) calisir: sessionStorage'dan gelen activeTab bir
  // doviz/altinsa ve o an NORMAL'de hic dogrudan islemi yoksa TL'ye dus (eski davranis). Oturum
  // ici bilerek secim etkilenmez (isKnownAsset korumasi orada gecerli). Arama deep-link ile
  // bilerek gelindiyse (state.deepLink) dokunma.
  const didMountResetRef = useRef(false);
  useEffect(() => {
    if (didMountResetRef.current) return;
    didMountResetRef.current = true;
    if ((dlLocation.state as { deepLink?: unknown } | null)?.deepLink) return;
    const knownAsset = (allFormTypes.currencies.includes(activeTab) && activeTab !== 'NAKIT' && activeTab !== 'YK') || allFormTypes.golds.includes(activeTab);
    if (knownAsset && !availableTabs.includes(activeTab)) {
      setActiveTab('NAKIT');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback if active tab disappears (e.g. settings changed)
  useEffect(() => {
    // Doviz/Altin + Altin modundayken aktif sekme bir ALTIN turudur; onu availableTabs'a
    // (yalnizca dovizler) gore "gecersiz" sayip sifirlama -> yoksa altin-modu senkron efekti
    // ile catisip sonsuz donguye girer (sekme "Gram <-> aldigin doviz" titremesi).
    const inGoldMode = activeSubTab === 'EXCHANGE' && exchangeTabMode === 'GOLD';
    // Secilen bilinen bir varlik (doviz/altin) availableTabs'ta olmasa da sifirlanmasin;
    // yoksa Normal'de doviz butonu secince fallback onu TL'ye geri ceker (revert).
    const isKnownAsset = (allFormTypes.currencies.includes(activeTab) && activeTab !== 'NAKIT' && activeTab !== 'YK') || allFormTypes.golds.includes(activeTab);
    if (!inGoldMode && !availableTabs.includes(activeTab) && !isKnownAsset) {
      setActiveTab(availableTabs[0] || 'NAKIT');
    }
    if (type !== 'NEW_CURRENCY' && !allFormTypes.currencies.includes(type) && !allFormTypes.golds.includes(type)) {
      setType('NAKIT');
    }
  }, [availableTabs, allFormTypes, activeTab, type, activeSubTab, exchangeTabMode]);


  // Ensure 'type' is set to a valid gold type when switching to GOLD mode.
  // Yalnizca Doviz/Altin (EXCHANGE) sekmesinde calisir: altin modu acik kalmisken
  // Nakit/Faturalar sekmesine gecilirse tip'i altina zorlayip fallback ile donguye girmesin.
  useEffect(() => {
    if (activeSubTab !== 'EXCHANGE') return;
    if (exchangeTabMode === 'GOLD' && !isGoldType(type)) {
      // Once o ay HAREKETI olan ilk altin turu (liste bos gorunmesin); yoksa ilk tanimli tur (Gram).
      const firstGold = activeGoldTypes[0] || allFormTypes.golds[0];
      if (firstGold) {
        setType(firstGold);
        setActiveTab(firstGold);
      }
    } else if (exchangeTabMode === 'CURRENCY' && isGoldType(type)) {
        setType('NAKIT');
        setActiveTab('NAKIT');
    }
  }, [activeSubTab, exchangeTabMode, allFormTypes.golds, activeGoldTypes, type, setType, setActiveTab, isGoldType]);

  // Reset date draft if it belongs to a past day.
  // todayStr'e bağlı: uygulama açıkken gece yarısı geçse de yeniden çalışır.
  useEffect(() => {
    const today = todayStr;
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
  }, [todayStr]);

  // Gece yarısı geçtiğinde fatura formunun tarihi de ilerlesin.
  // Yalnızca hâlâ "dünkü bugün"ü gösteren alan güncellenir; kullanıcının elle
  // seçtiği tarih veya düzenleme modundaki fatura tarihi korunur.
  const prevTodayRef = useRef(todayStr);
  useEffect(() => {
    const prevToday = prevTodayRef.current;
    if (prevToday === todayStr) return;
    prevTodayRef.current = todayStr;
    setBillDate(current => (current === prevToday ? todayStr : current));
  }, [todayStr]);

  // Sync date input with viewDate when viewDate changes
  useEffect(() => {
    const today = getTodayStr();
    const todayMonth = today.substring(0, 7); // YYYY-MM
    
    if (viewDate === todayMonth) {
      setDate(today);
    } else {
      // Set to first day of viewDate
      setDate(`${viewDate}-01`);
    }
  }, [viewDate]);

  // Kartlar o varligin GERCEK aylik toplamini gosterir (alt-sekmeden bagimsiz): ornegin Dolar
  // icin "Bu Ayki Giris" = tum Dolar girisi (275 alim dahil), "Bu Ay Harcanan" = tum Dolar cikisi.
  // Liste ve sekmeler alt-sekmeye gore suzulur; kartlar varlik OZETIDIR.
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

  // Altin (isGoldType) birikimi dailyExpenses'te DEGIL Kasa kayitlarinda (vaultRecords)
  // tutulur; bu yuzden altin ozet kartlari Kasa'dan hesaplanir. Isaret/haric mantigi
  // Bilanço (Dashboard computeValue altin dali) ile BIREBIR ayni tutulmali ki ayni deger
  // gorunsun: 'Düğün Hediyesi / Takı' haric, 'Borç Verdim' sayilmaz, 'Birikim' +, digerleri -.
  // goldTotalBirikim: goruntulenen aya kadarki (o ay dahil) net toplam birikim.
  const goldTotalBirikim = useMemo(() => {
    if (!isGoldType(activeTab)) return 0;
    return (vaultRecords || [])
      .filter(r => r && r.gold_type === activeTab
        && (r.transaction_type || 'Birikim') !== 'Düğün Hediyesi / Takı'
        && typeof r.record_date === 'string' && r.record_date.slice(0, 7) <= viewDate)
      .reduce((sum, r) => {
        const amt = Number(r.amount) || 0;
        const tType = r.transaction_type || 'Birikim';
        if (tType === 'Borç Verdim') return sum;
        return tType === 'Birikim' ? sum + amt : sum - amt;
      }, 0);
  }, [vaultRecords, activeTab, viewDate]);

  // goldMonthIncome: yalniz goruntulenen aydaki altin girisi ('Birikim'), 'Bu Ayki Giriş' karti.
  const goldMonthIncome = useMemo(() => {
    if (!isGoldType(activeTab)) return 0;
    return (vaultRecords || [])
      .filter(r => r && r.gold_type === activeTab
        && (r.transaction_type || 'Birikim') === 'Birikim'
        && typeof r.record_date === 'string' && r.record_date.slice(0, 7) === viewDate)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [vaultRecords, activeTab, viewDate]);

  // Bir altin Kasa kaydinin (vaultRecords) TL-maliyet ikizini (NAKIT "Altın Alımı/Satışı:
  // {miktar} {tur}", ayni gun) bulur. Altin Islemleri listesindeki sentetik satirlarin
  // Duzenle/Sil'i bu kanitlanmis TL-ayagi handler'larina yonlendirilir (tek mantik kaynagi).
  const findGoldTwinLeg = (rec: { transaction_type?: string; amount: number; gold_type: string; record_date: string }) => {
    const action = (rec.transaction_type || 'Birikim') === 'Bozdurma' ? 'Satışı' : 'Alımı';
    const prefix = `Altın ${action}: ${Number(rec.amount) || 0} ${rec.gold_type}`;
    return activeExpenses.find(e => e.type === 'NAKIT' && e.date === rec.record_date && (e.description || '').startsWith(prefix));
  };

  const handleEdit = (expense: DailyExpense) => {
    // Altin Islemleri listesindeki sentetik Kasa satiri (vault-gold-): TL-ayagi varsa onun
    // KANITLANMIS duzenlemesine yonlendir (vault senkronu orada olur); yoksa (fiyatsiz kayit)
    // gold formunu dogrudan Kasa kaydiyla doldur (bkz. handleSubmit vault-gold dali).
    if (expense.id.startsWith('vault-gold-')) {
      const vaultId = parseInt(expense.id.replace('vault-gold-', ''), 10);
      const rec = vaultRecords.find(r => r.id === vaultId);
      const twin = rec ? findGoldTwinLeg(rec) : undefined;
      if (twin) { handleEdit(twin); return; }
      if (rec) {
        setActiveSubTab('EXCHANGE');
        setExchangeTabMode('GOLD');
        setDate(String(rec.record_date).slice(0, 10));
        setType(rec.gold_type);
        setActiveTab(rec.gold_type);
        setAmount(String(Number(rec.amount) || 0));
        setGoldTransactionType((rec.transaction_type || 'Birikim') === 'Bozdurma' ? 'Bozdurma' : 'Birikim');
        setGoldOwner(rec.owner || '');
        setGoldNote(rec.note || '');
        setGoldPriceTL('');
        setDescription('');
        setEditingId(expense.id);
        scrollToElement('edit-form-card');
      }
      return;
    }
    // Duzenle formu (Kayit Duzenle) yalniz NORMAL alt-sekmede render edilir. Doviz kasa
    // (vault-curr) veya takas kaydi EXCHANGE sekmesinden duzenlenmek istenirse forma
    // gecmeden once NORMAL'e al ki form gorunsun (aksi halde "duzenlenmiyor" gibi durur).
    // Geldigi sekmeyi hatirla ki kaydet/iptal sonrasi oraya geri donsun (NORMAL'e "atilmis" kalmasin).
    editReturnSubTabRef.current = activeSubTab !== 'NORMAL' ? activeSubTab : null;
    setActiveSubTab('NORMAL');
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
    } else if (expense.id.startsWith('vault-curr-')) {
      // Doviz kasa kaydi: gosterilen aciklama "sahip: not" (ve turetilmis Kur) bicimindedir.
      // Forma HAM not'u koy; aksi halde submit not'a sahip on-ekini tekrar yazip "RG: RG: ..."
      // ikilemesi yapar. Sahip alani (r.owner) updateVaultRecord'da degismeden korunur.
      const vaultId = parseInt(expense.id.replace('vault-curr-', ''), 10);
      const vr = vaultRecords.find(r => r.id === vaultId);
      setDescription(vr?.note || '');
      setGoldOwner('');
      setGoldNote('');
    } else {
      setDescription(expense.description);
      setGoldOwner('');
      setGoldNote('');
    }

    scrollToElement('edit-form-card');
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

  // Doviz/Altin sekmesinden baslatilan bir duzenlemenin kaydet/iptal'inden sonra kullaniciyi
  // geldigi alt-sekmeye geri dondur. Bu yoldan gelen duzenlemeler yalniz DOVIZ kayitlaridir
  // (altin vault-gold- ustten EXCHANGE+GOLD'da kalir) -> donusu CURRENCY moduyla goster.
  const restoreEditSubTab = () => {
    const t = editReturnSubTabRef.current;
    editReturnSubTabRef.current = null;
    if (t && t !== 'NORMAL') {
      if (t === 'EXCHANGE') setExchangeTabMode('CURRENCY');
      setActiveSubTab(t);
    }
  };

  const cancelEditAndReturn = () => {
    cancelEdit();
    restoreEditSubTab();
  };

  // Sayfadan ayrilinca (baska sayfaya gecis) ACIK DUZENLEME iptal: kalici editingId draft'i
  // temizlenir -> sayfaya donunce ekleme modunda acilir. editingBillId useState oldugu icin
  // zaten sifirlanir. Ekleme taslagi (editingId yoksa) korunur.
  const editCleanupRef = useRef<() => void>(() => {});
  editCleanupRef.current = () => { if (editingId) cancelEdit(); };
  useEffect(() => () => editCleanupRef.current(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    if (isGoldType(type) && !goldOwner) return;
    if (!isGoldType(type) && !description) return;

    const numAmount = parseFloat(amount);

    if (isGoldType(type)) {
      // Altin Islemleri listesindeki TL-ayagi OLMAYAN Kasa kaydinin duzenlenmesi (vault-gold-):
      // dogrudan vault kaydini guncelle; duzenleme sirasinda TL fiyati girildiyse bir TL-ayagi olustur.
      if (editingId && editingId.startsWith('vault-gold-')) {
        const vaultId = parseInt(editingId.replace('vault-gold-', ''), 10);
        if (!isNaN(vaultId)) {
          await updateVaultRecord(vaultId, {
            record_date: date,
            owner: goldOwner,
            gold_type: type,
            amount: numAmount,
            note: goldNote,
            transaction_type: goldTransactionType
          });
          if (goldPriceTL) {
            const total = parseFloat(goldPriceTL);
            if (!isNaN(total) && total > 0) {
              const isSale = goldTransactionType === 'Bozdurma';
              addDailyExpense({
                date,
                description: `Altın ${isSale ? 'Satışı' : 'Alımı'}: ${numAmount} ${type}`,
                amount: isSale ? total : -total,
                type: 'NAKIT'
              });
            }
          }
        }
        setEditingId(null);
        setGoldOwner('');
        setGoldNote('');
        setGoldPriceTL('');
        setAmount('');
        return;
      }

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
        const total = parseFloat(goldPriceTL);
        const qty = numAmount;
        let rateStr = '';
        if (!isNaN(total) && total > 0 && !isNaN(qty) && qty > 0) {
          rateStr = ` (Birim Fiyat: ${(total / qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL)`;
        }
        const finalVaultNote = goldPriceTL ? `${goldNote ? goldNote + ' | ' : ''}${goldTransactionType === 'Bozdurma' ? 'Satış' : 'Alış'} Tutarı: ${goldPriceTL} TL${rateStr}` : goldNote;

        if (isFuture) {
          const actionStr = goldTransactionType === 'Bozdurma' ? 'Satışı' : 'Alımı';
          const title = `Planlanan ${type} ${actionStr}`;

          await addFixedExpense({
            title,
            amount: goldPriceTL ? parseFloat(goldPriceTL) : 0,
            type: 'PLANNED_VAULT',
            vault_gold_type: type,
            vault_amount: numAmount,
            vault_owner: goldOwner,
            vault_note: finalVaultNote
          });
        } else {
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

              const actionStr = isSale ? 'Satışı' : 'Alımı';
              const categoryStr = isGoldType(type) ? 'Altın' : 'Döviz';
              const tlDesc = `${categoryStr} ${actionStr}: ${numAmount} ${type}`;
              
              addDailyExpense({
                date,
                description: tlDesc,
                amount: tlFinalAmount,
                type: 'NAKIT' // TL
              });
            }
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
        if (isFuture) {
          if (finalType !== 'NAKIT' && finalType !== 'YK') {
            const actionStr = finalAmount >= 0 ? 'Alımı' : 'Satışı';
            const title = `Planlanan ${finalType} ${actionStr}`;

            await addFixedExpense({
              title,
              amount: 0,
              type: 'PLANNED_VAULT',
              vault_gold_type: finalType,
              vault_amount: Math.abs(finalAmount),
              vault_owner: 'Ortak',
              vault_note: description
            });
          } else {
            if (finalAmount < 0) {
              await addFixedExpense({
                title: description,
                amount: Math.abs(finalAmount),
                type: finalType
              });
            } else {
              await addCustomIncome({
                title: description,
                amount: finalAmount,
                type: finalType
              });
            }
          }
        } else {
          addDailyExpense({
            date,
            description,
            amount: finalAmount,
            type: finalType
          });
        }
        setType(finalType);
        setActiveTab(finalType);
        setCustomCurrencyCode('');
      }
      setDescription('');
    }
    
    setAmount('');

    // Ekleme (duzenleme degil) yapildiysa ve kayit secilen tarihin ayina (goruntulenen
    // aydan farkli) dustuyse, o ayi goster ki kullanici eklenen kaydi gorsun.
    if (!editingId) {
      const targetMonth = String(date).substring(0, 7);
      if (targetMonth && targetMonth !== viewDate) setViewDate(targetMonth);
    }

    sessionStorage.removeItem('daily_draft_desc');
    sessionStorage.removeItem('daily_draft_amount');
    sessionStorage.removeItem('daily_draft_editing_id');

    // Doviz/Altin sekmesinden gelinen bir duzenleme kaydedildiyse o sekmeye geri don (no-op degilse).
    restoreEditSubTab();
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

    let rateStr = '';
    if (finalFromType === 'NAKIT' && finalToType !== 'NAKIT') {
      rateStr = ` (Kur: ${(fAmount / tAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL)`;
    } else if (finalFromType !== 'NAKIT' && finalToType === 'NAKIT') {
      rateStr = ` (Kur: ${(tAmount / fAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL)`;
    } else {
      rateStr = ` (Kur: ${(tAmount / fAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${finalToType}/${finalFromType})`;
    }

    const finalExchangeNote = exchangeNote.trim() ? `${exchangeNote.trim()}${rateStr}` : rateStr.trim();
    const note = finalExchangeNote ? ` - ${finalExchangeNote}` : '';

    // NAKIT -> Dolar = Dolar Alımı (Nakit çıkışı, Dolar girişi)
    // Dolar -> NAKIT = Dolar Satışı (Dolar çıkışı, Nakit girişi)
    // Dolar -> Euro = Euro Alımı (Takas)

    let fDesc = `Dönüşüm Çıkışı: ${fAmount} ${finalFromType} -> ${tAmount} ${finalToType}${note}`;
    let tDesc = `Dönüşüm Girişi: ${fAmount} ${finalFromType} -> ${tAmount} ${finalToType}${note}`;

    if (finalFromType === 'NAKIT' && finalToType !== 'NAKIT') {
      fDesc = `${tAmount} ${finalToType} Alımı${note}`; // Nakit'ten düşecek (Gider)
      tDesc = `${tAmount} ${finalToType} Alımı${note}`; // Döviz/Altın'a eklenecek (Gelir)
    } else if (finalFromType !== 'NAKIT' && finalToType === 'NAKIT') {
      fDesc = `${fAmount} ${finalFromType} Satışı${note}`; // Döviz/Altın'dan düşecek
      tDesc = `${fAmount} ${finalFromType} Satışı${note}`; // Nakit'e eklenecek
    } else if (finalFromType !== 'NAKIT' && finalToType !== 'NAKIT') {
      fDesc = `${tAmount} ${finalToType} Alımı (Takas)${note}`;
      tDesc = `${tAmount} ${finalToType} Alımı (Takas)${note}`;
    }

    if (isFuture) {
      const isSale = finalToType === 'NAKIT';
      const plannedAsset = isSale ? finalFromType : finalToType;
      const plannedAssetAmount = isSale ? fAmount : tAmount;
      const tlAmount = isSale ? tAmount : (finalFromType === 'NAKIT' ? fAmount : 0);
      
      const actionStr = isSale ? 'Satışı' : 'Alımı';
      const title = `Planlanan ${plannedAsset} ${actionStr}`;
      await addFixedExpense({
        title,
        amount: tlAmount,
        type: 'PLANNED_VAULT',
        vault_gold_type: plannedAsset,
        vault_amount: plannedAssetAmount,
        vault_owner: 'Ortak',
        vault_note: finalExchangeNote
      });
    } else {
      addDailyExpense({
        date: exchangeDate,
        description: fDesc,
        amount: -fAmount,
        type: finalFromType
      });

      if (isGoldType(finalFromType)) {
        await addVaultRecord({ record_date: exchangeDate, owner: 'Ortak', amount: fAmount, note: fDesc, transaction_type: 'Bozdurma', gold_type: finalFromType });
      }

      addDailyExpense({
        date: exchangeDate,
        description: tDesc,
        amount: tAmount,
        type: finalToType
      });

      if (isGoldType(finalToType)) {
        await addVaultRecord({ record_date: exchangeDate, owner: 'Ortak', amount: tAmount, note: tDesc, transaction_type: 'Birikim', gold_type: finalToType });
      }
    }


    // Eklenen takas, secilen tarihin ayina (goruntulenen aydan farkli) dustuyse o ayi goster
    // (handleSubmit ile ayni davranis); aksi halde baska ay tarihli takas "kaybolmus" gibi gorunur.
    if (!isFuture) {
      const targetMonth = String(exchangeDate).substring(0, 7);
      if (targetMonth && targetMonth !== viewDate) setViewDate(targetMonth);
    }

    setExchangeFromAmount('');
    setExchangeToAmount('');
    setExchangeNote('');
    setExchangeFromCustomCode('');
    setExchangeToCustomCode('');
    setActiveTab(finalToType);
  };

  const handleDeleteClick = async (expense: DailyExpense) => {
    if (!await askConfirmation('Bu işlemi silmek istediğinize emin misiniz?')) return;

    if (isFuture) {
      if (state.fixedExpenses.some(ex => ex.id === expense.id)) {
        await deleteFixedExpense(expense.id);
      } else if (state.customIncomes.some(inc => inc.id === expense.id)) {
        await deleteCustomIncome(expense.id);
      }
      return;
    }

    if (expense.id.startsWith('vault-gold-')) {
      // Altin Islemleri listesindeki sentetik Kasa satiri: Kasa kaydini ve (varsa) TL-ayagini sil.
      const vaultId = parseInt(expense.id.replace('vault-gold-', ''), 10);
      if (!isNaN(vaultId)) {
        const rec = vaultRecords.find(r => r.id === vaultId);
        await deleteVaultRecord(vaultId);
        if (rec) {
          const twin = findGoldTwinLeg(rec);
          if (twin) await deleteDailyExpense(twin.id);
        }
      }
      return;
    }

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

        // Check if this is an exchange record
        const matchExchange = descStr.match(/^Dönüşüm (Çıkışı|Girişi):\s+([\d.]+)\s+(.*?)\s+->\s+([\d.]+)\s+(.*?)(?:\s+-|$)/);
        if (matchExchange) {
          const isOutflow = matchExchange[1] === 'Çıkışı';
          const oppTypeStr = isOutflow ? 'Girişi' : 'Çıkışı';
          const partnerDescPrefix = `Dönüşüm ${oppTypeStr}: ${matchExchange[2]} ${matchExchange[3]} -> ${matchExchange[4]} ${matchExchange[5]}`;

          const targetCurrency = isOutflow ? matchExchange[5].trim() : matchExchange[3].trim();
          const targetAmount = parseFloat(isOutflow ? matchExchange[4] : matchExchange[2]);

          if (isGoldType(targetCurrency)) {
             const vaultMatch = vaultRecords.find(r =>
                r.gold_type === targetCurrency &&
                Number(r.amount) === targetAmount &&
                r.record_date === expense.date &&
                (r.note || '').startsWith(partnerDescPrefix)
             );
             if (vaultMatch && vaultMatch.id) {
               await deleteVaultRecord(vaultMatch.id);
             }
          } else {
             const partnerExpense = activeExpenses.find(e => e.date === expense.date && (e.description || '').startsWith(partnerDescPrefix));
             if (partnerExpense) {
               await deleteDailyExpense(partnerExpense.id);
             }
          }
        }

        // Check and delete twin currency transaction (Nakit <-> Currency)
        if (expense.type === 'NAKIT' || expense.type === 'YK') {
          const twin = activeExpenses.find(e =>
            e.id !== expense.id &&
            e.date === expense.date &&
            e.description === expense.description &&
            e.type !== 'NAKIT' &&
            e.type !== 'YK'
          );
          if (twin) {
            deleteDailyExpense(twin.id);
          }
        } else if (EXCHANGE_TAKAS.test(descStr)) {
          // Doviz <-> Doviz TAKAS: iki bacak da NAKIT/YK DEGIL (or. Dolar -> Suriye Lirasi).
          // Iki bacak ayni tarih + ayni aciklama ("... Alimi (Takas) ...") tasir ama FARKLI
          // tip ve ZIT isaret (cikis negatif / giris pozitif). Hangi bacaktan silinirse
          // digerini de sil. (Not: altin takaslari isGoldType ust dalinda ele alinir.)
          const twin = activeExpenses.find(e =>
            e.id !== expense.id &&
            e.date === expense.date &&
            e.description === expense.description &&
            e.type !== expense.type &&
            (e.amount < 0) !== (expense.amount < 0)
          );
          if (twin) {
            deleteDailyExpense(twin.id);
          }
        } else {
          const twin = activeExpenses.find(e =>
            e.id !== expense.id &&
            e.date === expense.date &&
            e.description === expense.description &&
            (e.type === 'NAKIT' || e.type === 'YK')
          );
          if (twin) {
            deleteDailyExpense(twin.id);
          }
        }
      }
      deleteDailyExpense(expense.id);
    }
  };

  const filteredExpenses = useMemo(() => {
    // Altin Islemleri (EXCHANGE + altin sekmesi): satirlar Kasa'dan (vaultRecords) uretilir —
    // altin YALNIZ vaultRecords'ta tutulur, dailyExpenses'te degil (bkz. Kasa mimarisi). Boylece
    // altin alimi Doviz Takasi'nda degil kendi sekmesinde, ozet kartiyla (Gram) tutarli gorunur.
    // (Gelecek ay plan akisi ayri: PLANNED_VAULT activeExpenses'ten gelir.)
    if (!isFuture && activeSubTab === 'EXCHANGE' && isGoldType(activeTab)) {
      // HIBRIT liste (altin iki yoldan girer, veri sekilleri farkli):
      //  (1) Takas kokenli (Doviz Takasi NAKIT->Altin): handleExchangeSubmit GERCEK bir altin-tipli
      //      dailyExpense uretir -> mevcut Duzenle/Sil akisiyla calisir; oldugu gibi goster.
      //  (2) Altin formu kokenli: altin YALNIZ vaultRecords'ta (dailyExpense yok) -> sentetik satir
      //      uret (vault-gold-). Yalniz Birikim/Bozdurma (formun uretebildigi iki tur); 'Borç Verdim'
      //      / 'Düğün Hediyesi / Takı' Kasa'da yonetilir, 2-durumlu form onlari bozardi.
      //  Karsiligi (1)'de zaten olan vault kayitlarini (2)'de TEKRAR gostermemek icin ele -> cift yok.
      const goldExpenses = activeExpenses.filter(e => passesSubTabFilter(e, activeTab, activeSubTab, isFuture));
      const synth = (vaultRecords || [])
        .filter(r => r && r.gold_type === activeTab
          && typeof r.record_date === 'string' && r.record_date.slice(0, 7) === viewDate
          && ((r.transaction_type || 'Birikim') === 'Birikim' || r.transaction_type === 'Bozdurma')
          && !goldExpenses.some(e => e.date === r.record_date && Math.abs(e.amount) === (Number(r.amount) || 0)))
        .map(r => {
          const tType = r.transaction_type || 'Birikim';
          const amt = Number(r.amount) || 0;
          const label = tType === 'Bozdurma' ? 'Altın Satışı' : 'Altın Alımı';
          return {
            id: `vault-gold-${r.id}`,
            date: r.record_date,
            description: `${label}: ${amt} ${r.gold_type}`,
            amount: tType === 'Birikim' ? amt : -amt,
            type: activeTab,
          } as DailyExpense;
        });
      return [...goldExpenses, ...synth];
    }
    const base = activeExpenses.filter(e => passesSubTabFilter(e, activeTab, activeSubTab, isFuture));
    // Doviz Takasi (EXCHANGE + doviz/NAKIT sekmesi): altin maliyet ayaklarini ("Altın Alımı/Satışı: ...")
    // bu listeden gizle -> yalniz gercek doviz takaslari kalir (altin kendi sekmesinde gorunur).
    if (activeSubTab === 'EXCHANGE' && !isGoldType(activeTab)) {
      return base.filter(e => !/^Altın (Alımı|Satışı):/.test((e.description || '').trim()));
    }
    return base;
  }, [activeExpenses, activeTab, activeSubTab, isFuture, vaultRecords, viewDate]);

  const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
    const date = expense.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    // Son eklenen harcama gün içinde en üstte görünsün diye başa ekle
    // (yeni harcamalar diziye sona eklendiğinden unshift ile ters sıralanır).
    groups[date].unshift(expense);
    return groups;
  }, {} as Record<string, DailyExpense[]>);

  const handleBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billTitle || !billAmount) return;

    const numAmount = parseFloat(billAmount);
    
    if (editingBillId) {
      updateFixedExpense(editingBillId, {
        title: billTitle,
        amount: numAmount,
        paymentMethod: billPaymentMethod,
        isBill: true,
        date: billDate,
        cardId: billPaymentMethod === 'KK' ? (billCardId || creditCards[0]?.id) : undefined
      });
      setEditingBillId(null);
    } else {
      addFixedExpense({
        title: billTitle,
        amount: numAmount,
        paymentMethod: billPaymentMethod,
        isBill: true,
        date: billDate,
        cardId: billPaymentMethod === 'KK' ? (billCardId || creditCards[0]?.id) : undefined
      });
    }

    setBillTitle('');
    setBillAmount('');
    setBillPaymentMethod('NAKIT');
    setBillDate(getTodayStr());
  };

  const handleEditBill = (bill: any) => {
    setEditingBillId(bill.id);
    setBillTitle(bill.title);
    setBillAmount(bill.amount.toString());
    setBillPaymentMethod(bill.paymentMethod || 'NAKIT');
    setBillCardId(bill.cardId || '');
    setBillDate(bill.date || getTodayStr());
    scrollToElement('edit-bill-form-card');
  };

  const handleCancelEditBill = () => {
    setEditingBillId(null);
    setBillTitle('');
    setBillAmount('');
    setBillPaymentMethod('NAKIT');
    setBillDate(getTodayStr());
  };

  const sortedDates = Object.keys(groupedExpenses).sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  );

  const assetOptions = (
    <>
      <option value="NAKIT">TL</option>
      {showMealCard && <option value="YK">Yemek Kartı</option>}
      {activeCurrencies.map(curr => (<option key={curr} value={curr}>{getAssetFullTitle(curr)}</option>))}
      <option value="NEW_CURRENCY">+ Diğer Para Birimi Ekle...</option>
    </>
  );

  return (
    <div id="main-form-container" className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">İşlem Tutanağı</h1>
          {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Planlama Modu</span>}
          <SearchTrigger className="hidden md:flex ml-auto" />
          <PrivacyTrigger className="hidden md:flex" />
        </div>
        <MonthNavigator onDoubleClick={activeSubTab !== 'BILLS' ? () => setShowCalendar(v => !v) : undefined} />
      </header>
      
      {isFuture && (
        <div className="p-4 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-500/20 text-center text-sm font-semibold mb-2">
          Bilgi: Planlama modundasınız. Gelecek aylar için yapacağınız altın/döviz ekleme işlemleri doğrudan kasaya yansımak yerine otomatik olarak Sabit Giderler sayfasına bir plan olarak kaydedilecektir.
        </div>
      )}

      <div className="space-y-4">
        {/* Sekme Seçici */}
        <div className="flex gap-2 p-1 bg-secondary rounded-lg">
           <button
              onClick={() => switchSubTab('NORMAL')}
              className={cn(
                 "flex-1 py-1.5 text-sm font-semibold rounded-md transition-all",
                 activeSubTab === 'NORMAL' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:bg-secondary/80"
              )}
           >
              Normal İşlem
           </button>
           <button
              onClick={() => switchSubTab('EXCHANGE')}
              className={cn(
                 "flex-1 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2",
                 activeSubTab === 'EXCHANGE' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:bg-secondary/80"
              )}
           >
              Döviz/Altın İşlemleri
           </button>
           <button
              onClick={() => switchSubTab('BILLS')}
              className={cn(
                 "flex-1 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5",
                 activeSubTab === 'BILLS' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:bg-secondary/80"
              )}
           >
              Faturalar
              {dueBillsCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {dueBillsCount}
                  </span>
                </span>
              )}
              {autoPaidBillsCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-none">
                  {autoPaidBillsCount}
                </span>
              )}
           </button>
        </div>

      {activeSubTab === 'EXCHANGE' && (
        <Card title="Varlık Dönüştür (Takas)" collapsible={!editingId} open={exchangeFormOpen} onToggleOpen={toggleExchangeForm}>
          <div className="flex gap-2 mb-4 bg-secondary p-1 rounded-lg">
             <button
                type="button"
                onClick={() => setExchangeTabMode('CURRENCY')}
                className={cn(
                   "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                   exchangeTabMode === 'CURRENCY' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
             >
                Döviz Takası
             </button>
             <button
                type="button"
                onClick={() => setExchangeTabMode('GOLD')}
                className={cn(
                   "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                   exchangeTabMode === 'GOLD' ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
             >
                Altın İşlemleri
             </button>
          </div>

          <div className="space-y-1 mb-3">
            <label className="text-xs text-muted-foreground">Tarih</label>
            <input
              type="date"
              value={date}
              disabled={isFuture}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {exchangeTabMode === 'CURRENCY' ? (
          <form onSubmit={handleExchangeSubmit} className="space-y-3 mt-2">
            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div className="flex-1 space-y-1">
                 <label className="text-xs text-muted-foreground">Verilen Birim</label>
                 <select value={exchangeFromType} onChange={e => setExchangeFromType(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary">
                   <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                 </select>
              </div>
              <div className="flex-1 space-y-1">
                 <label className="text-xs text-muted-foreground">Tutar</label>
                 <input type="number" step="0.001" required placeholder="0.00" value={exchangeFromAmount} onChange={e => handleFromAmountChange(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {exchangeFromType === 'NEW_CURRENCY' && (
               <div className="space-y-1 mb-2">
                 <label className="text-xs text-muted-foreground">Yeni Verilen Para Birimi Adı (Örn: Dolar)</label>
                 <input type="text" required placeholder="Para Birimi Girin" value={exchangeFromCustomCode} onChange={e => setExchangeFromCustomCode(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
               </div>
            )}

            <div className="flex justify-center text-muted-foreground py-1">
              <ArrowRightLeft size={20} className="rotate-90" />
            </div>

            <div className="flex flex-col md:flex-row gap-2 md:items-end">
              <div className="flex-1 space-y-1">
                 <label className="text-xs text-muted-foreground">Alınan Birim</label>
                 <select value={exchangeToType} onChange={e => setExchangeToType(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary">
                   <optgroup label="Para Birimleri">{assetOptions}</optgroup>
                 </select>
              </div>
              <div className="flex-1 space-y-1">
                 <label className="text-xs text-muted-foreground">Tutar</label>
                 <input type="number" step="0.001" required placeholder="0.00" value={exchangeToAmount} onChange={e => handleToAmountChange(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {exchangeToType === 'NEW_CURRENCY' && (
               <div className="space-y-1 mt-1 mb-2">
                 <label className="text-xs text-muted-foreground">Yeni Alınan Para Birimi Adı (Örn: Dolar)</label>
                 <input type="text" required placeholder="Para Birimi Girin" value={exchangeToCustomCode} onChange={e => setExchangeToCustomCode(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
               </div>
            )}

            <div className="space-y-1">
               <label className="text-xs text-muted-foreground">Birim Fiyat / Kur</label>
               <input
                 type="number"
                 step="0.0001"
                 placeholder="Birim Fiyat (Otomatik hesaplanır veya girin)"
                 value={exchangeRate}
                 onChange={e => handleExchangeRateChange(e.target.value)}
                 className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium"
               />
            </div>

            {calculatedExchangeRate && (
               <div className="p-3 bg-primary/10 text-primary rounded-lg text-sm font-semibold text-center border border-primary/20">
                 {calculatedExchangeRate}
               </div>
            )}

            <div className="space-y-1">
               <label className="text-xs text-muted-foreground">Not</label>
               <input type="text" placeholder="Özel not veya kur bilgisi (İsteğe bağlı)" value={exchangeNote} onChange={e => setExchangeNote(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="w-full h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/95 transition-colors">
                {isFuture ? 'Döviz Takası Planla' : 'Döviz Takası Kaydet'}
              </button>
            </div>
          </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Altın Türü</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setActiveTab(e.target.value); }}
                className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                <optgroup label="Altın Türleri (Kasa)">
                  {allFormTypes.golds.map(gold => (
                    <option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>
                  ))}
                </optgroup>
              </select>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:items-end">
               <div className="space-y-1 col-span-1">
                  <label className="text-xs text-muted-foreground">Miktar (Adet/Gram)</label>
                  <input type="number" step="0.001" required placeholder="Örn: 5" value={amount} onChange={e => setAmount(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
               </div>
               <div className="space-y-1 col-span-1">
                  <label className="text-xs text-muted-foreground">Toplam Tutar (TL)</label>
                  <input type="number" step="0.01" required placeholder="Örn: 15000" value={goldPriceTL} onChange={e => setGoldPriceTL(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
               </div>
               <div className="space-y-1 col-span-1">
                  <label className="text-xs text-muted-foreground">Birim Fiyat (TL)</label>
                  <input type="text" readOnly value={calculatedGoldUnitPrice} className="w-full h-11 px-3 rounded-xl bg-secondary/50 text-muted-foreground border border-dashed border-border focus:outline-none font-mono font-bold cursor-not-allowed text-center text-sm" />
               </div>
             </div>

            <div className="space-y-1">
               <label className="text-xs text-muted-foreground">Kime Ait (Kasa Sahibi)</label>
               <input type="text" required placeholder="Örn: Ahmet, Ayşe veya Ortak" value={goldOwner} onChange={e => setGoldOwner(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
               {goldOwner.trim() && ownerCheck && (
                 ownerCheck.isUser && !ownerCheck.isSelf ? (
                   <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 bg-primary/10 text-primary border border-primary/20">
                     <span aria-hidden="true">👤</span>
                     <span><span className="font-semibold">{goldOwner.trim()}</span> kullanıcısına gönderilecek — kabul edene dek sizin toplamınızda görünür, kabul edince onun hesabına geçer.</span>
                   </div>
                 ) : ownerCheck.isSelf ? (
                   <div className="text-xs text-muted-foreground px-1">Kendi altınınız — toplamınıza eklenir.</div>
                 ) : null
               )}
            </div>

            <div className="space-y-1">
               <label className="text-xs text-muted-foreground">Not</label>
               <input type="text" placeholder="Özel not (İsteğe bağlı)" value={goldNote} onChange={e => setGoldNote(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-secondary focus:ring-2 focus:ring-primary font-medium" />
            </div>

            <div className="flex gap-2 pt-1">
                <button
                type="button"
                onClick={() => { setGoldTransactionType('Birikim'); setTransactionType('INCOME'); }}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-colors ${goldTransactionType === 'Birikim' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                >
                Birikim
                </button>
                <button
                type="button"
                onClick={() => { setGoldTransactionType('Bozdurma'); setTransactionType('EXPENSE'); }}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-colors ${goldTransactionType === 'Bozdurma' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                >
                Bozdurma
                </button>
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
                className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
            </div>
          )}

          <div className="flex gap-2 mt-2">
              {editingId && (
              <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 h-11 bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
              >
                  <X size={20} /> İptal
              </button>
              )}
              <button
              type="submit"
              className="flex-[2] h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
              {editingId ? 'Güncelle' : 'Altın İşlemini Kaydet'}
              </button>
          </div>
          </form>
          )}
        </Card>
      )}

      {activeSubTab === 'NORMAL' && (
      <Card id="edit-form-card" title={editingId ? "Kayıt Düzenle" : "Yeni İşlem Ekle"} collapsible={!editingId} open={addFormOpen} onToggleOpen={toggleAddForm}>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-3">
              <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tarih</label>
              <input
                  type="date"
                  value={date}
                  disabled={isFuture}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
              </div>
              <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tutar</label>
              <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              </div>
          </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Açıklama</label>
              <input
                type="text"
                required
                list="daily-expense-suggestions"
                placeholder="Bu para nereden geldi/nereye gitti?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-colors ${transactionType === 'INCOME' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                >
                Gelir (+)
                </button>
                <button
                type="button"
                onClick={() => setTransactionType('EXPENSE')}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-colors ${transactionType === 'EXPENSE' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-secondary border-transparent text-muted-foreground'}`}
                >
                Gider (-)
                </button>
            </div>

          <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Varlık / Para Birimi</label>
              <div className="flex gap-1 p-1 bg-secondary rounded-xl overflow-x-auto whitespace-nowrap scrollbar-none">
                {[{ v: 'NAKIT', l: 'TL' }, ...(showMealCard ? [{ v: 'YK', l: 'Yemek Kartı' }] : []), ...activeCurrencies.map(c => ({ v: c, l: getAssetFullTitle(c) }))].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => { setType(opt.v); setActiveTab(opt.v); }}
                    className={cn(
                      "shrink-0 h-10 px-4 rounded-lg text-sm transition-all",
                      type === opt.v ? "bg-background shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setType('NEW_CURRENCY')}
                  className={cn(
                    "shrink-0 h-10 px-4 rounded-lg text-sm transition-all flex items-center gap-1",
                    type === 'NEW_CURRENCY' ? "bg-background shadow-sm text-foreground font-medium" : "text-primary hover:text-primary/80"
                  )}
                >
                  + Diğer
                </button>
              </div>
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
                className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
            </div>
          )}

          <div className="flex gap-2 mt-2">
              {editingId && (
              <button
                  type="button"
                  onClick={cancelEditAndReturn}
                  className="flex-1 h-11 bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
              >
                  <X size={20} /> İptal
              </button>
              )}
              <button
              type="submit"
              className="flex-[2] h-11 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
              {editingId ? 'Güncelle' : 'Ekle'}
              </button>
          </div>
          </form>
      </Card>
      )}

      {activeSubTab === 'BILLS' && (
        <Card id="edit-bill-form-card" title={editingBillId ? "Faturayı Düzenle" : "Yeni Fatura Ekle"} collapsible={!editingBillId} open={billFormOpen} onToggleOpen={toggleBillForm}>
          <form onSubmit={handleBillSubmit} className="space-y-4 mt-2">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-[2] space-y-1">
                <label className="text-xs text-muted-foreground">Fatura Adı</label>
                <input
                  type="text"
                  placeholder="Elektrik, Su, İnternet vb."
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tutar (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Ödeme Yöntemi</label>
                <select
                  value={billPaymentMethod}
                  onChange={(e) => setBillPaymentMethod(e.target.value as 'NAKIT' | 'KK')}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <option value="NAKIT">Nakit (TL)</option>
                  <option value="KK">Kredi Kartı</option>
                </select>
              </div>
              {billPaymentMethod === 'KK' && creditCards.length >= 2 && (
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Kart</label>
                  <select
                    value={billCardId || creditCards[0]?.id}
                    onChange={(e) => setBillCardId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  >
                    {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Tarih</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {editingBillId && (
                <button
                  type="button"
                  onClick={handleCancelEditBill}
                  className="flex-1 h-11 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 font-medium transition-colors"
                >
                  İptal
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 font-medium transition-colors"
              >
                {editingBillId ? 'Güncelle' : 'Fatura Ekle'}
              </button>
            </div>
          </form>
        </Card>
      )}
      </div>

      {activeSubTab !== 'BILLS' && viewDate <= state.currentMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card title={`${isGoldType(activeTab) ? 'Toplam Birikim' : 'Bu Ay Harcanan'} (${getAssetFullTitle(activeTab)})`} className={`${isGoldType(activeTab) ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className={`text-2xl font-bold mt-2 ${isGoldType(activeTab) ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-500'}`}>
                 <Secret>{isGoldType(activeTab) ? goldTotalBirikim.toLocaleString('tr-TR') : currentMonthSpent.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}</Secret>
              </div>
            </Card>
            <Card title={`Bu Ayki Gelir / Giriş (${getAssetFullTitle(activeTab)})`} className="bg-gradient-to-br from-transparent to-green-500/12 border-green-500/30">
              <div className="text-2xl font-bold text-green-500 mt-2">
                 <Secret>{isGoldType(activeTab) ? goldMonthIncome.toLocaleString('tr-TR') : currentMonthIncome.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}</Secret>
              </div>
            </Card>
        </div>
      )}

      {/* Faturalar Sekmesi İçeriği */}
      {activeSubTab === 'BILLS' && (
        <div className="space-y-6">
          {/* Otomatik ödeme bildirimleri: KK faturası günü gelince otomatik ödendi.
              X ile kapatılınca (dismissAutoPaidBill) rozet düşer. */}
          {autoPaidBills.length > 0 && (
            <div className="space-y-2">
              {autoPaidBills.map((bill) => {
                // Tarih dili: bugunse "bugün", degilse "GG Ay YYYY tarihinde".
                const dateText = bill.date === todayStr
                  ? 'bugün'
                  : (bill.date ? `${format(new Date(bill.date), 'd MMMM yyyy', { locale: tr })} tarihinde` : '');
                return (
                  <div key={bill.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-sky-500/40 bg-sky-500/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                        <CreditCard size={18} />
                      </div>
                      <div className="text-sm text-foreground min-w-0 leading-relaxed">
                        <span className="font-semibold"><Secret>{bill.amount.toLocaleString('tr-TR')} ₺</Secret></span> tutarındaki <span className="font-semibold">{bill.title}</span> faturanız <span className="font-semibold">{dateText}</span> kredi kartınızla ödendi.
                      </div>
                    </div>
                    <button
                      onClick={() => dismissAutoPaidBill(bill.id)}
                      title="Bildirimi kapat"
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fatura Özet Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-secondary/40 border border-border/60 p-4 rounded-xl shadow-sm">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Toplam Fatura</div>
              <div className="text-2xl font-black text-foreground mt-1">
                <Secret>{totalBillsAmount.toLocaleString('tr-TR')} ₺</Secret>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {currentMonthBills.length} adet fatura planı
              </div>
            </div>
            
            <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-xl shadow-sm">
              <div className="text-xs text-green-500/80 font-semibold uppercase tracking-wider">Ödenen Faturalar</div>
              <div className="text-2xl font-black text-green-500 mt-1">
                <Secret>{paidBillsAmount.toLocaleString('tr-TR')} ₺</Secret>
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {currentMonthBills.filter(e => e.isPaid).length} adet ödendi
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl shadow-sm">
              <div className="text-xs text-red-500/80 font-semibold uppercase tracking-wider">Kalan / Ödenmeyen</div>
              <div className="text-2xl font-black text-red-500 mt-1">
                <Secret>{unpaidBillsAmount.toLocaleString('tr-TR')} ₺</Secret>
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {currentMonthBills.filter(e => !e.isPaid).length} adet ödenmedi
              </div>
            </div>
          </div>

          {/* Segmentli Fatura Çubuğu (Grafik) */}
          <Card title="Fatura Dağılım Grafiği">
            <div className="space-y-4">
              <div className="h-4 w-full rounded-full bg-secondary overflow-hidden flex shadow-inner border border-border/20">
                {currentMonthBills.length === 0 ? (
                  <div className="w-full h-full bg-secondary/50" />
                ) : (
                  currentMonthBills.map((bill, index) => {
                    const percentage = totalBillsAmount > 0 ? (bill.amount / totalBillsAmount) * 100 : 0;
                    return (
                      <div
                        key={bill.id}
                        style={{ width: `${percentage}%`, backgroundColor: billColors[index % billColors.length] }}
                        className="h-full transition-all hover:opacity-85"
                        title={`${bill.title}: ${bill.amount.toLocaleString('tr-TR')} ₺`}
                      />
                    );
                  })
                )}
              </div>

              {/* Renkli Lejant Listesi */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
                {currentMonthBills.map((bill, index) => (
                  <div key={bill.id} className="flex items-center gap-1.5 font-medium">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: billColors[index % billColors.length] }}
                    />
                    <span className="text-foreground">{bill.title}</span>
                    <span className="text-muted-foreground">(<Secret>{bill.amount.toLocaleString('tr-TR')} ₺</Secret>)</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Fatura Listesi */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Fatura Listesi
            </h3>

            {groupedBills.sortedKeys.map((date) => {
              const dailyTotal = groupedBills.groups[date].reduce((sum, item) => sum + item.amount, 0);
              return (
                <div key={date} className="space-y-3">
                  <div className="flex justify-between items-center ml-1 pr-1">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), 'd MMMM yyyy, EEEE', { locale: tr })}
                    </h3>
                    <span className="text-sm font-bold text-muted-foreground">
                      <Secret>{dailyTotal.toLocaleString('tr-TR')} ₺</Secret>
                    </span>
                  </div>

                  {groupedBills.groups[date].map((bill) => (
                    <div
                      key={bill.id}
                      data-search-key={searchKeyFor('bill', bill.id)}
                      onClick={() => { if (sel.active) sel.toggle(bill.id); }}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl glass transition-all",
                        // Odeme gunu gelmis ama hala odenmemisse uyari cercevesi.
                        // Odendi isaretlenince kosul dusecegi icin normale doner.
                        !bill.isPaid && !!bill.date && bill.date <= todayStr
                          ? "border-red-500/60 bg-gradient-to-br from-transparent to-red-500/15"
                          : "border-border",
                        bill.isPaid && "opacity-60",
                        sel.active && "cursor-pointer",
                        sel.isSelected(bill.id) && "ring-2 ring-primary bg-primary/5"
                      )}
                    >
                      <button
                        {...sel.pressProps(bill.id, () => toggleFixedExpense(bill.id))}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        {sel.isSelected(bill.id) ? (
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0"><Check size={16} strokeWidth={3} /></span>
                        ) : bill.isPaid ? (
                          <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                        ) : (
                          <Circle className="text-muted-foreground flex-shrink-0" size={24} />
                        )}
                        <div className="text-left min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("font-medium truncate", bill.isPaid && "line-through")}>
                              {bill.title}
                            </span>
                            {bill.paymentMethod === 'KK' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider">
                                <CreditCard size={10} /> Kart
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-wider">
                                <Wallet size={10} /> Nakit
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-nowrap mt-0.5">
                            <span className="font-semibold text-foreground/95"><Secret>{bill.amount.toLocaleString('tr-TR')} ₺</Secret></span>
                          </div>
                        </div>
                      </button>

                      {!sel.active && (
                      <div className="flex items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditBill(bill); }}
                          className="p-2 text-primary hover:text-primary/80 transition-colors"
                        >
                          <Pencil size={20} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await askConfirmation('Bu fatura kaydını silmek istediğinize emin misiniz?')) {
                              deleteFixedExpense(bill.id);
                              if (editingBillId === bill.id) handleCancelEditBill();
                            }
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {groupedBills.noDateGroup.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1 pr-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Tarihsiz Faturalar</h3>
                  <span className="text-sm font-bold text-muted-foreground">
                    <Secret>{groupedBills.noDateGroup.reduce((sum, item) => sum + item.amount, 0).toLocaleString('tr-TR')} ₺</Secret>
                  </span>
                </div>

                {groupedBills.noDateGroup.map((bill) => (
                  <div
                    key={bill.id}
                    data-search-key={searchKeyFor('bill', bill.id)}
                    onClick={() => { if (sel.active) sel.toggle(bill.id); }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl glass transition-all",
                      bill.isPaid && "opacity-60",
                      sel.active && "cursor-pointer",
                      sel.isSelected(bill.id) && "ring-2 ring-primary bg-primary/5"
                    )}
                  >
                    <button
                      {...sel.pressProps(bill.id, () => toggleFixedExpense(bill.id))}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      {sel.isSelected(bill.id) ? (
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0"><Check size={16} strokeWidth={3} /></span>
                      ) : bill.isPaid ? (
                        <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                      ) : (
                        <Circle className="text-muted-foreground flex-shrink-0" size={24} />
                      )}
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cn("font-medium truncate", bill.isPaid && "line-through")}>
                            {bill.title}
                          </span>
                          {bill.paymentMethod === 'KK' ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider">
                              <CreditCard size={10} /> Kart
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-wider">
                              <Wallet size={10} /> Nakit
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-nowrap mt-0.5">
                          <span className="font-semibold text-foreground/95"><Secret>{bill.amount.toLocaleString('tr-TR')} ₺</Secret></span>
                        </div>
                      </div>
                    </button>

                    {!sel.active && (
                    <div className="flex items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditBill(bill); }}
                        className="p-2 text-primary hover:text-primary/80 transition-colors"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await askConfirmation('Bu fatura kaydını silmek istediğinize emin misiniz?')) {
                            deleteFixedExpense(bill.id);
                            if (editingBillId === bill.id) handleCancelEditBill();
                          }
                        }}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentMonthBills.length === 0 && (
              <div className="text-center text-muted-foreground py-12 bg-secondary/30 rounded-xl border border-dashed">
                Bu ay için eklenmiş fatura bulunmuyor.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Normal / Döviz Altın Sekmeleri ve Listeleri */}
      {activeSubTab !== 'BILLS' && (
        <>
          {/* Tek tur (tek doviz/altin ya da yalniz Nakit) olsa bile o ismin sekmesi gorunur.
              Yalnizca hic sekme yokken (>=1 saglanmaz) cubuk cizilmez. */}
          {exchangeTabChips.length >= 1 && (
            <div className="flex p-1 bg-secondary rounded-xl overflow-x-auto whitespace-nowrap scrollbar-none gap-1">
                {exchangeTabChips.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); if (isGoldType(tab)) setType(tab); }}
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

          {showCalendar ? (
            <SpendingCalendar
              viewDate={viewDate}
              entries={filteredExpenses.map(e => ({ date: e.date, amount: e.amount }))}
              symbol={getAssetUnitLabel(activeTab)}
              label={getAssetFullTitle(activeTab)}
            />
          ) : (
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
                     <Secret>{dailyTotal > 0 ? '+' : ''}{dailyTotal.toLocaleString('tr-TR')}{isGoldType(activeTab) ? ' ' : ''}{getAssetUnitLabel(activeTab)}</Secret>
                  </span>
                </div>
                {groupedExpenses[date].map((expense) => {
                  const isGold = isGoldType(expense.type);
                  return (
                  <div
                    key={expense.id}
                    data-search-key={searchKeyFor('daily', expense.id)}
                    onClick={() => { if (sel.active) sel.toggle(expense.id); }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl glass transition-all",
                      sel.active && "cursor-pointer",
                      sel.isSelected(expense.id) && "ring-2 ring-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                        <div {...sel.pressProps(expense.id)} className={cn("p-2 rounded-full cursor-pointer", sel.isSelected(expense.id) ? "bg-primary text-primary-foreground" : expense.type === 'NAKIT' ? 'bg-green-500/10 text-green-500' : isGold ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500')}>
                          {sel.isSelected(expense.id) ? <Check size={20} /> : expense.type === 'NAKIT' ? <Banknote size={20} /> : <CreditCard size={20} />}
                        </div>
                        <div>
                          <div className="font-medium">{expense.description}</div>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className={`font-bold whitespace-nowrap ${expense.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {expense.amount > 0 ? '+' : ''}
                          <Secret>{expense.amount.toLocaleString('tr-TR')}{isGoldType(expense.type) ? ' ' : ''}{getAssetUnitLabel(expense.type)}</Secret>
                        </div>
                        {!sel.active && (
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
                        )}
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
          )}
        </>
      )}

      {sel.active && (() => {
        // Secili kalemlerin net toplami (liste birimine gore). Faturalar hep
        // gider oldugundan duz toplam; digerlerinde isaretli (gelir-gider) toplam.
        // (Her dal ayri dizi tipiyle calisir: birlesik tipte filter/reduce TS hatasi verir.)
        if (activeSubTab === 'BILLS') {
          const items = currentMonthBills.filter(b => sel.isSelected(b.id));
          const net = items.reduce((s, b) => s + b.amount, 0);
          return <SelectionBar count={items.length} amountText={`${net.toLocaleString('tr-TR')} ₺`} onClose={sel.exit} />;
        }
        const items = filteredExpenses.filter(e => sel.isSelected(e.id));
        const net = items.reduce((s, e) => s + e.amount, 0);
        const text = `${net > 0 ? '+' : ''}${net.toLocaleString('tr-TR')}${isGoldType(activeTab) ? ' ' : ''}${getAssetUnitLabel(activeTab)}`;
        return <SelectionBar count={items.length} amountText={text} onClose={sel.exit} />;
      })()}
    </div>
  );
}
