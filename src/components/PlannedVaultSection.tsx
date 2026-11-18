import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBudget } from '../context/BudgetContext';
import { CheckCircle, Trash2, Calendar, Edit2, X, Pencil } from 'lucide-react';
import type { FixedExpense } from '../types';
import { isGoldType, searchKeyFor } from '../lib/search';
import { cn, toLocalMonthStr } from '../lib/utils';


const getAssetFullTitle = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('altın') || lower.includes('lira')) return name;
    if (lower === 'gram') return 'Gram Altın';
    if (lower === 'çeyrek') return 'Çeyrek Altın';
    if (lower === 'yarım') return 'Yarım Altın';
    if (lower === 'tam') return 'Tam Altın';
    if (lower === 'ata') return 'Ata Altın';
    if (lower === 'reşat') return 'Reşat Altın';
    if (lower === 'bilezik') return 'Bilezik Altın';
    if (lower === 'külçe') return 'Külçe Altın';
    return `${name} Altın`;
};

export function PlannedVaultSection() {
    const {
        state,
        viewDate,
        setViewDate,
        addFixedExpense,
        updateFixedExpense,
        deleteFixedExpense,
        removePlanFromMonth,
        addVaultRecord,
        addDailyExpense,
        activeCurrencies,
        askConfirmation
    } = useBudget();

    const navigate = useNavigate();

    // "Gerçekleşti" işaretli planlar (id -> ait olduğu ay). Onayla'da işaretlenir, silinmez;
    // Varlıklarım'dan ayrılınca (unmount) bu planlar YAKALANAN ayından silinir.
    const [realized, setRealized] = useState<Record<string, string>>({});
    const realizedRef = useRef<Record<string, string>>({});
    realizedRef.current = realized;
    const redirectTimerRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (redirectTimerRef.current != null) clearTimeout(redirectTimerRef.current);
        Object.entries(realizedRef.current).forEach(([id, month]) => removePlanFromMonth(id, month));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Akordiyon aç/kapa (harçlık kartı gibi). Yalnız gelecek aylarda "her zaman" görünür;
    // cari/geçmişte yalnız bekleyen plan varsa (ör. plan vade ayına geldiyse Onayla'yabilmek için).
    const [open, setOpen] = useState(false);
    const isFuture = viewDate > toLocalMonthStr();
    const goToExchange = () => {
        navigate('/islemler', { state: { deepLink: { subTab: 'EXCHANGE', exchangeMode: 'CURRENCY' } } });
    };

    const [title, setTitle] = useState('');
    const [amountTL, setAmountTL] = useState('');
    const [goldType, setGoldType] = useState('Gram');
    const [goldAmount, setGoldAmount] = useState('');
    const [goldOwner, setGoldOwner] = useState('');
    const [goldNote, setGoldNote] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);

    const [customCurrencyCode, setCustomCurrencyCode] = useState('');
    const [plannedUnitPrice, setPlannedUnitPrice] = useState('');

    const plannedRecords = state.fixedExpenses.filter(e => e.type === 'PLANNED_VAULT');

    const formatRateValue = (val: number): string => {
        if (isNaN(val) || val <= 0) return '';
        return val % 1 === 0 ? val.toFixed(0) : parseFloat(val.toFixed(2)).toString();
    };

    const detectCurrencyCode = (code: string) => {
        const c = code.toUpperCase().trim();
        if (c.includes('USD') || c.includes('$') || c.includes('DOLAR')) return 'Dolar';
        if (c.includes('EUR') || c.includes('€') || c.includes('EURO')) return 'Euro';
        if (c.includes('GBP') || c.includes('£') || c.includes('STERLIN')) return 'Sterlin';
        return c;
    };

    const calculatedUnitPriceText = React.useMemo(() => {
        const total = parseFloat(amountTL);
        const qty = parseFloat(goldAmount);
        if (isNaN(total) || total <= 0 || isNaN(qty) || qty <= 0) return null;
        const rate = total / qty;
        const unitName = goldType === 'NEW_CURRENCY' ? detectCurrencyCode(customCurrencyCode) : goldType;
        return `Hesaplanan Birim Fiyat: 1 ${unitName} = ${formatRateValue(rate)} TL`;
    }, [amountTL, goldAmount, goldType, customCurrencyCode]);

    const allFormTypes = {
        golds: ['Gram', 'Çeyrek', 'Yarım', 'Tam', 'Ata', 'Reşat', 'Bilezik', 'Külçe', 'Has'],
        currencies: (activeCurrencies && activeCurrencies.length > 0) ? activeCurrencies : ['Dolar', 'Euro']
    };

    const handleEdit = (record: FixedExpense) => {
        setEditingId(record.id);
        setTitle(record.title);
        setAmountTL(record.amount.toString());
        setGoldType(record.vault_gold_type || 'Gram');
        const qty = record.vault_amount || 0;
        setGoldAmount(qty ? qty.toString() : '');
        setGoldOwner(record.vault_owner || '');
        setGoldNote(record.vault_note || '');
        const total = record.amount;
        if (total > 0 && qty > 0) {
            setPlannedUnitPrice(formatRateValue(total / qty));
        } else {
            setPlannedUnitPrice('');
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setAmountTL('');
        setGoldType('Gram');
        setGoldAmount('');
        setGoldOwner('');
        setGoldNote('');
        setCustomCurrencyCode('');
        setPlannedUnitPrice('');
    };

    const handleGoldAmountChange = (val: string) => {
        setGoldAmount(val);
        const qty = parseFloat(val);
        const total = parseFloat(amountTL);
        const rate = parseFloat(plannedUnitPrice);
        if (!isNaN(qty) && qty > 0) {
            if (!isNaN(total) && total > 0) {
                setPlannedUnitPrice(formatRateValue(total / qty));
            } else if (!isNaN(rate) && rate > 0) {
                setAmountTL((qty * rate).toFixed(2));
            }
        }
    };

    const handleAmountTLChange = (val: string) => {
        setAmountTL(val);
        const total = parseFloat(val);
        const qty = parseFloat(goldAmount);
        const rate = parseFloat(plannedUnitPrice);
        if (!isNaN(total) && total > 0) {
            if (!isNaN(qty) && qty > 0) {
                setPlannedUnitPrice(formatRateValue(total / qty));
            } else if (!isNaN(rate) && rate > 0) {
                setGoldAmount((total / rate).toFixed(2));
            }
        }
    };

    const handlePlannedUnitPriceChange = (val: string) => {
        setPlannedUnitPrice(val);
        const rate = parseFloat(val);
        const qty = parseFloat(goldAmount);
        const total = parseFloat(amountTL);
        if (!isNaN(rate) && rate > 0) {
            if (!isNaN(qty) && qty > 0) {
                setAmountTL((qty * rate).toFixed(2));
            } else if (!isNaN(total) && total > 0) {
                setGoldAmount((total / rate).toFixed(2));
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let finalType = goldType;
        if (goldType === 'NEW_CURRENCY') {
            if (!customCurrencyCode) return;
            finalType = detectCurrencyCode(customCurrencyCode);
        }

        const data = {
            title: title || `Planlanan ${finalType} Alımı`,
            amount: parseFloat(amountTL),
            type: 'PLANNED_VAULT',
            vault_gold_type: finalType,
            vault_amount: parseFloat(goldAmount),
            // Sahiplik yalnizca ALTIN'a ozgu (coklu-kullanici emaneti). Doviz'de owner sorulmaz -> 'Ortak' (takas gibi).
            vault_owner: isGoldType(finalType) ? goldOwner : 'Ortak',
            vault_note: goldNote
        };

        if (editingId) {
            updateFixedExpense(editingId, data);
        } else {
            addFixedExpense(data);
        }

        cancelEdit();
    };

    const handleExecute = async (record: FixedExpense) => {
        if (!(await askConfirmation("Bu planı gerçekleştirmek istediğinize emin misiniz?", "Planı Gerçekleştir"))) return;

        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        const executeDate = d.toISOString().split('T')[0];

        const vGoldType = record.vault_gold_type || 'Bilinmiyor';
        const vAmount = record.vault_amount || 0;

        const isSale = record.title?.toLowerCase().includes('satış') || record.title?.toLowerCase().includes('bozdurma');
        const actionStr = isSale ? 'Satışı' : 'Alımı';
        const approvedDesc = `${vAmount} ${vGoldType} ${actionStr}`;

        const finalVaultNote = record.amount ? `${record.vault_note ? record.vault_note + ' | ' : ''}Alış Fiyatı: ${record.amount} TL` : record.vault_note;

        // Kasa kaydı (yeni id döner) + TL alım gideri (bugün -> cari ay).
        const newId = await addVaultRecord({
            record_date: executeDate,
            // Döviz'de sahiplik yok -> 'Ortak'; yalnız altında plandaki sahip kullanılır.
            owner: isGoldType(vGoldType) ? (record.vault_owner || 'Bilinmiyor') : 'Ortak',
            gold_type: vGoldType,
            amount: vAmount,
            note: finalVaultNote,
            transaction_type: isSale ? 'Bozdurma' : 'Birikim'
        });
        addDailyExpense({ date: executeDate, description: approvedDesc, amount: -record.amount, type: 'NAKIT' });

        // Planı SİLME; "gerçekleşti" işaretle (ait olduğu ay = şu an bakılan ay). Kart yeşerir.
        const planMonth = viewDate;
        setRealized(prev => ({ ...prev, [record.id]: planMonth }));

        // Kısa bir an "Gerçekleşti" göründükten sonra İşlemler'e yönlendir: cari ay, Döviz/Altın,
        // ilgili tür, yeni işlem kartına kaydır. Plan, Varlıklarım'dan ayrılırken (unmount) temizlenir.
        const gold = isGoldType(vGoldType);
        const entryId = gold ? `vault-gold-${newId}` : `vault-curr-${newId}`;
        redirectTimerRef.current = window.setTimeout(() => {
            setViewDate(toLocalMonthStr());
            navigate('/islemler', {
                state: {
                    deepLink: {
                        subTab: 'EXCHANGE',
                        exchangeMode: gold ? 'GOLD' : 'CURRENCY',
                        assetTab: vGoldType,
                        key: newId != null ? searchKeyFor('daily', entryId) : undefined,
                    }
                }
            });
        }, 800);
    };

    // Düzenleme formu — ilgili planın satırının İÇİNDE akordiyon olarak açılır (harçlık kartı gibi).
    const editForm = (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">İşlem Cinsi</label>
                    <select value={goldType} onChange={(e) => setGoldType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium">
                        <optgroup label="Altın Türleri (Kasa)">
                            {allFormTypes.golds.map(gold => (<option key={gold} value={gold}>{getAssetFullTitle(gold)}</option>))}
                        </optgroup>
                        <optgroup label="Döviz Türleri (Kasa)">
                            {allFormTypes.currencies.map(currency => (<option key={currency} value={currency}>{currency}</option>))}
                            <option value="NEW_CURRENCY">+ Yeni Ekle</option>
                        </optgroup>
                    </select>
                </div>
                {goldType === 'NEW_CURRENCY' && (
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Yeni Para Birimi</label>
                        <input type="text" required placeholder="Örn: Dolar, $" value={customCurrencyCode} onChange={(e) => setCustomCurrencyCode(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium" />
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Miktar (Altın/Döviz)</label>
                    <input type="number" step="0.01" required placeholder="Örn: 100" value={goldAmount} onChange={(e) => handleGoldAmountChange(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tahmini TL Maliyeti (Rezerve Edilecek)</label>
                    <input type="number" step="0.01" required placeholder="Örn: 3300" value={amountTL} onChange={(e) => handleAmountTLChange(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Birim Fiyat (TL)</label>
                    <input type="number" step="0.0001" placeholder="Birim Fiyat (Miktar veya Tutar girildiğinde hesaplanır)" value={plannedUnitPrice} onChange={(e) => handlePlannedUnitPriceChange(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium" />
                </div>
                {calculatedUnitPriceText && (
                    <div className="md:col-span-2 p-3 bg-primary/10 text-primary rounded-lg text-sm font-semibold text-center border border-primary/20">
                        {calculatedUnitPriceText}
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Başlık (Opsiyonel)</label>
                    <input type="text" placeholder="Örn: Ağustos Dolar Alımı" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                {isGoldType(goldType) && (
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sahibi</label>
                        <input type="text" required placeholder="Örn: Ben, Eşim vb." value={goldOwner} onChange={(e) => setGoldOwner(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                )}
                <div className="space-y-1 md:col-span-2">
                    <label className="text-xs text-muted-foreground">Not</label>
                    <input type="text" placeholder="Not eklenebilir..." value={goldNote} onChange={(e) => setGoldNote(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={cancelEdit} className="flex-1 py-3 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
                    <X size={20} /> İptal
                </button>
                <button type="submit" className="flex-[2] py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                    <Calendar size={20} /> Planı Güncelle
                </button>
            </div>
        </form>
    );

    // Gelecek ay DEĞİL ve bekleyen plan da yoksa kartı hiç gösterme (cari/geçmişi kirletmesin).
    if (!isFuture && plannedRecords.length === 0) return null;

    return (
        <div>
          {/* Harçlık kartı gibi akordiyon: başlık satırı + kalemle aç/kapa. */}
          <div className={cn(open && "rounded-xl glass overflow-hidden")}>
            <div className={cn("flex items-center justify-between p-4 transition-all", !open && "rounded-xl glass")}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-6 flex-shrink-0" aria-hidden="true" />
                <div className="text-left min-w-0 flex-1">
                  <span className="font-medium truncate block">Döviz/Altın Yatırım Planı</span>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {plannedRecords.length > 0 ? `${plannedRecords.length} bekleyen plan` : 'Plan yok'}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <button type="button" onClick={() => setOpen(v => !v)} title={open ? 'Kapat' : 'Aç'} className="p-2 text-primary hover:text-primary/80 transition-colors">
                  <Pencil size={20} />
                </button>
              </div>
            </div>
            {open && (
              <div className="border-t border-border/50 bg-gradient-to-br from-transparent to-emerald-500/12 px-4 pt-4 pb-4 space-y-4">
            {plannedRecords.length > 0 ? (
                    <div className="space-y-2">
                        {plannedRecords.map(record => (
                            <div key={record.id} className={cn("rounded-xl border overflow-hidden", realized[record.id] ? "bg-green-500/5 border-green-500/30" : "bg-secondary/30 border-border")}>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-lg truncate">{record.title || `Planlanan ${record.vault_gold_type} Alımı`}</h3>
                                            {realized[record.id] ? (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 whitespace-nowrap inline-flex items-center gap-1"><CheckCircle size={12} /> Gerçekleşti</span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 whitespace-nowrap">Beklemede</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <div><span className="font-medium text-foreground">Hedef:</span> {record.vault_amount} {record.vault_gold_type}</div>
                                            <div><span className="font-medium text-foreground">Maliyet:</span> {record.amount} TL</div>
                                            {isGoldType(record.vault_gold_type || '') && <div><span className="font-medium text-foreground">Sahibi:</span> {record.vault_owner}</div>}
                                            {record.vault_note && <div className="col-span-2 truncate"><span className="font-medium text-foreground">Not:</span> {record.vault_note}</div>}
                                        </div>
                                    </div>
                                    {/* "Gerçekleşti" işaretli planda işlem butonları gizlenir (tekrar onay/düzenleme olmasın) */}
                                    {!realized[record.id] && (
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        <button
                                            onClick={() => handleExecute(record)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors text-sm font-medium"
                                            title="Gerçekleşti"
                                        >
                                            <CheckCircle size={16} />
                                            <span>Onayla</span>
                                        </button>
                                        <button
                                            onClick={() => editingId === record.id ? cancelEdit() : handleEdit(record)}
                                            className={cn("p-1.5 transition-colors", editingId === record.id ? "text-primary" : "text-muted-foreground hover:text-primary")}
                                            title={editingId === record.id ? 'Düzenlemeyi kapat' : 'Düzenle'}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteFixedExpense(record.id)}
                                            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                                            title="Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    )}
                                </div>
                                {/* Düzenleme: harçlık gibi, bu satırın İÇİNDE akordiyon olarak açılır */}
                                {editingId === record.id && (
                                    <div className="border-t border-border bg-gradient-to-br from-transparent to-emerald-500/12 p-4">
                                        {editForm}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
            ) : (isFuture && !editingId && (
                    <div className="px-1">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Plan eklemek için İşlemler'de{' '}
                        <button type="button" onClick={goToExchange} className="font-semibold text-primary hover:underline underline-offset-2 transition-colors">
                          Döviz/Altın İşlemleri sekmesine gidin.
                        </button>
                      </p>
                    </div>
            ))}
              </div>
            )}
          </div>
        </div>
    );
}
