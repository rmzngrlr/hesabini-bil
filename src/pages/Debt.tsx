import { useDraftState } from '../hooks/useDraftState';
import { useBudget, generateId, resolveCardId, cardCutoffOf } from '../context/BudgetContext';
import { Card } from '../components/ui/Card';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, CalendarClock, CreditCard, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, scrollToElement, scrollToSearchKey, getTodayStr, isDebtPending, statementMonth } from '../lib/utils';
import { searchKeyFor } from '../lib/search';
import { SearchTrigger } from '../components/SearchTrigger';
import { PrivacyTrigger } from '../components/PrivacyTrigger';
import { Secret } from '../components/Secret';
import { MonthNavigator } from '../components/MonthNavigator';
import { SpendingCalendar } from '../components/SpendingCalendar';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { CCDebt } from '../types';

export default function Debt() {
  const { state, viewDate, setViewDate, addCCDebt, updateCCDebt, deleteCCDebt, addInstallment, deleteInstallment, addDailyExpense, askConfirmation, todayStr, ccDueNotices, dismissCCDueNotice, statementCutoffDay, creditCards } = useBudget();

  // --- Coklu kredi karti: tarih barinin altinda kart-cevirir bar. Tümü YOK; sayfa 1. kartta acilir,
  // ‹ › ile kartlar arasi gecilir. Yalniz Borç sayfasi gruplamasi; Bilanço tek toplam. Yonetim Ayarlar'da. ---
  const cards = creditCards && creditCards.length ? creditCards : [];
  const multiCard = cards.length >= 2;
  // Sayfa daima 1. kartta acilir; oturum icinde flip-bar ile degistirilir (kalici degil).
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const effSel = cards.some(c => c.id === selectedCardId) ? selectedCardId : (cards[0]?.id || '');
  const flipCard = (delta: number) => {
    const order = cards.map(c => c.id);
    if (!order.length) return;
    const i = Math.max(0, order.indexOf(effSel));
    setSelectedCardId(order[(i + delta + order.length) % order.length]);
  };
  // Eklenen borc/taksit her zaman goruntulenen (secili) karta gider.
  const targetCardId = effSel || resolveCardId(undefined);
  const cardById = (id?: string) => cards.find(c => c.id === resolveCardId(id));

  // --- Global arama deep-link tuketimi (viewDate goToRecord'da ayarlanir; burada scroll + temizlik) ---
  const dlLocation = useLocation();
  const dlNavigate = useNavigate();
  useEffect(() => {
    const dl = (dlLocation.state as { deepLink?: { key?: string } } | null)?.deepLink;
    if (!dl || !dl.key) return;
    scrollToSearchKey(dl.key);
    dlNavigate(dlLocation.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlLocation.key]);

  const [description, setDescription] = useDraftState('debt_draft_desc', '');
  const [amount, setAmount] = useDraftState('debt_draft_amount', '');
  const [date, setDate] = useDraftState('debt_draft_date', getTodayStr());

  // Taksit modu
  const [isInstallment, setIsInstallment] = useDraftState('debt_draft_is_inst', false);
  const [installmentCount, setInstallmentCount] = useDraftState('debt_draft_inst_count', '2');
  const [transactionType, setTransactionType] = useDraftState<'SPEND' | 'PAY'>('debt_draft_tx_type', 'SPEND');
  const [editingId, setEditingId] = useDraftState<string | null>('debt_draft_editing_id', null);
  // Harcama, bakilan aydan farkli bir ekstreye dustugunde gosterilen gecici bilgi notu.
  const [addedNote, setAddedNote] = useState('');

  // "YYYY-MM" -> "Agustos 2026" (Turkce ay adi).
  const formatStatementMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return format(new Date(y, m - 1, 1), 'LLLL yyyy', { locale: tr });
  };

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
    scrollToElement('edit-form-card');
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

  // Sayfadan ayrilinca ACIK DUZENLEME iptal (kalici editingId draft'i temizlenir).
  const editCleanupRef = useRef<() => void>(() => {});
  editCleanupRef.current = () => { if (editingId) cancelEdit(); };
  useEffect(() => () => editCleanupRef.current(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) return;
    setAddedNote('');

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
            // Ortak bag: KK ödeme kaydi ile TL çıkışını bagla (silme/düzenlemede eşlenir).
            const paymentLinkId = generateId();
            addCCDebt({ description, amount: Math.abs(numAmount), date, paymentLinkId, cardId: targetCardId });
            // Otomatik olarak nakitten de düşmesini sağlıyoruz (Nakit gider olarak eklenir)
            addDailyExpense({
                // `date` zaten yerel "YYYY-MM-DD"; ISO'ya çevrilirse tam zaman damgası
                // olur ve İşlemler listesinde aynı gün ayrı bir grup olarak bölünür.
                date,
                description: description,
                amount: -Math.abs(numAmount),
                type: 'NAKIT',
                paymentLinkId
            });
        } else {
            const debtAmount = -Math.abs(numAmount);

            if (isInstallment) {
              const count = parseInt(installmentCount);
              if (count < 2) return;

              addInstallment({
                description,
                cardId: targetCardId,
                totalAmount: debtAmount * count,
                installmentCount: count,
                monthlyAmount: debtAmount,
                startDate: new Date(date).toISOString()
              });
            } else {
              addCCDebt({ description, amount: debtAmount, date, cardId: targetCardId });
            }
        }
    }

    // Harcama TARIHE gore farkli bir aya/ekstreye dustuyse o aya gec + bilgi notu goster
    // (taksit ve duzenleme haric). Kesim varsa kesim-ayi, yoksa tarihin takvim ayi kullanilir.
    const effCutoff = cardCutoffOf(creditCards, targetCardId, statementCutoffDay);
    if (!editingId && !isInstallment) {
      const s = statementMonth(date, effCutoff);
      if (s && s !== viewDate) {
        setViewDate(s);
        setAddedNote(effCutoff
          ? `Bu harcama ${formatStatementMonth(s)} ekstresine eklendi (kesim günü ${effCutoff}).`
          : `Bu harcama ${formatStatementMonth(s)} ayına eklendi.`);
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
  // Seçili karta göre süzülmüş borçlar (Tümü'de hepsi). Toplam/pending/liste bundan hesaplanır.
  const visibleDebts = useMemo(
    () => state.ccDebts.filter(d => resolveCardId(d.cardId) === effSel),
    [state.ccDebts, effSel]
  );
  const totalDebt = Math.abs(
    visibleDebts
      .filter(d => !isDebtPending(d.date, isCurrentMonth, todayStr))
      .reduce((sum, d) => sum + d.amount, 0)
  );
  // Tüm kartların toplamı (= Bilanço'daki tek sayı). Belirli kart seçiliyken ikincil satırda gösterilir.
  const grandTotalDebt = Math.abs(
    state.ccDebts
      .filter(d => !isDebtPending(d.date, isCurrentMonth, todayStr))
      .reduce((sum, d) => sum + d.amount, 0)
  );
  const pendingCount = visibleDebts.filter(d => isDebtPending(d.date, isCurrentMonth, todayStr)).length;
  const visibleInstallments = state.installments.filter(i => resolveCardId(i.cardId) === effSel);

  const groupedDebts = useMemo(() => {
    const groups: Record<string, CCDebt[]> = {};
    const noDateGroup: CCDebt[] = [];

    visibleDebts.forEach(debt => {
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
  }, [visibleDebts]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedDebts.groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedDebts.groups]);


  const isFuture = viewDate > getLocalMonth();
  // Tarih barina cift tiklama gunluk ekstre listesi yerine takvim gorunumunu acar/kapatir.
  const [showCalendar, setShowCalendar] = useState(false);
  // "İşlem Ekle" formu acilir-kapanir (cihaz-bazli tercih; VARSAYILAN KAPALI; duzenlerken zorla acik).
  const [addFormOpen, setAddFormOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('debt_addform_open') === 'true'; } catch { return false; }
  });
  const toggleAddForm = () => setAddFormOpen(o => {
    const n = !o;
    try { localStorage.setItem('debt_addform_open', String(n)); } catch { /* yoksay */ }
    return n;
  });

  return (
    <div id="main-form-container" className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Kredi Kartı Borçları</h1>
          {isFuture && <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Planlama Modu</span>}
          <SearchTrigger className="hidden md:flex ml-auto" />
          <PrivacyTrigger className="hidden md:flex" />
        </div>
        <MonthNavigator onDoubleClick={() => setShowCalendar(v => !v)} />
      </header>

      {multiCard && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-xl p-1.5">
          <button type="button" onClick={() => flipCard(-1)} aria-label="Önceki kart" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cardById(effSel)?.color || '#888' }} />
            {cardById(effSel)?.name}
            <span className="text-xs text-muted-foreground">· {cardCutoffOf(creditCards, effSel, statementCutoffDay) ? `kesim ${cardCutoffOf(creditCards, effSel, statementCutoffDay)}` : 'kesim yok'}</span>
          </div>
          <button type="button" onClick={() => flipCard(1)} aria-label="Sonraki kart" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {addedNote && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm border border-blue-500/20">
          <CalendarClock size={16} className="mt-0.5 shrink-0" />
          <span>{addedNote}</span>
        </div>
      )}

      {ccDueNotices.length > 0 && (
        <div className="space-y-2">
          {ccDueNotices.map((debt) => {
            const dateText = debt.date === todayStr
              ? 'bugün'
              : (debt.date ? `${format(new Date(debt.date), 'd MMMM yyyy', { locale: tr })} tarihinde` : '');
            return (
              <div key={debt.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-sky-500/40 bg-sky-500/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                    <CreditCard size={18} />
                  </div>
                  <div className="text-sm text-foreground min-w-0 leading-relaxed">
                    <span className="font-semibold"><Secret>{Math.abs(debt.amount).toLocaleString('tr-TR')} ₺</Secret></span> tutarındaki <span className="font-semibold">{debt.description}</span> harcamanız <span className="font-semibold">{dateText}</span> kredi kartı ekstrenize eklendi.
                  </div>
                </div>
                <button
                  onClick={() => dismissCCDueNotice(debt.id)}
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

      <Card title={`${cardById(effSel)?.name || 'Kredi Kartı'} — Bu Ay Ödenecek`} className="bg-gradient-to-br from-transparent to-red-500/12 border-red-500/25">
        <div className="text-3xl font-bold text-red-500 mt-2">
          <Secret>{totalDebt.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
        </div>
        {pendingCount > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            günü gelmemiş {pendingCount} kalem hariç
          </div>
        )}
        {multiCard && (
          <div className="text-xs text-muted-foreground mt-1">
            Tüm kartlar (Bilanço): <Secret>{grandTotalDebt.toLocaleString('tr-TR')} ₺</Secret>
          </div>
        )}
      </Card>

      <div id="edit-form-card"><Card title={editingId ? "İşlemi Düzenle" : "İşlem Ekle"} collapsible={!editingId} open={addFormOpen} onToggleOpen={toggleAddForm}>
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

          {/* Tarih kendi satirinda (Tutar bir alt satira iner). */}
          <div className="space-y-1">
             <label className="text-xs text-muted-foreground">Tarih</label>
             <input
               type="date"
               value={date}
               onChange={(e) => setDate(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
             />
          </div>

          {/* Tutar; taksitliyken Taksit adedi ayni satirda. */}
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
               <div className="flex-1 space-y-1">
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
      {visibleInstallments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Devam Eden Taksitler</h2>
          <div className="grid gap-3">
            {visibleInstallments.map((inst) => {
               const current = inst.installmentCount - inst.remainingInstallments + 1;

               return (
                 <div key={inst.id} data-search-key={searchKeyFor('installment', inst.id)} className="p-4 rounded-xl bg-secondary/30 border border-border">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <div className="font-medium">{inst.description}</div>
                         <div className="text-xs text-muted-foreground">
                           Toplam: <Secret>{Math.abs(inst.totalAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-bold text-red-500">
                           <Secret>{Math.abs(inst.monthlyAmount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>/ay
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
        <div>
          <h2 className="text-lg font-semibold">Bu Ayın Ekstresi</h2>
          {cardCutoffOf(creditCards, effSel, statementCutoffDay) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Kesim günü: her ayın {cardCutoffOf(creditCards, effSel, statementCutoffDay)}'i. Bu günden sonraki harcamalar sonraki ekstreye yazılır.
            </p>
          )}
        </div>

        {showCalendar ? (
          <SpendingCalendar
            viewDate={viewDate}
            entries={visibleDebts.map(d => ({ date: d.date || '', amount: d.amount }))}
            symbol="₺"
            label="Kredi Kartı"
          />
        ) : (
        <>
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
                  <Secret>{dailyTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
                </span>
              </div>

              {groupedDebts.groups[date].map((debt) => (
                <div key={debt.id} data-search-key={searchKeyFor('ccdebt', debt.id)} className="flex items-center justify-between p-4 rounded-xl glass">
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
                      <Secret>{debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
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
                <Secret>{groupedDebts.noDateGroup.reduce((sum, item) => sum + item.amount, 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
              </span>
            </div>

            {groupedDebts.noDateGroup.map((debt) => (
              <div key={debt.id} data-search-key={searchKeyFor('ccdebt', debt.id)} className="flex items-center justify-between p-4 rounded-xl glass">
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
                    <Secret>{debt.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }).replace(/\s|\u00A0/g, '')}</Secret>
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

         {visibleDebts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Borç kaydı bulunmamaktadır.
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
