import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { fetchWithAuth } from '../services/api';
import { Plus, Trash2, Edit2, Check, X, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface GoldRecord {
    id?: number;
    record_date: string;
    owner: string;
    gold_type: string;
    amount: number;
    note?: string;
    transaction_type?: string;
}

export default function Vault() {
    const { isAdmin } = useAuth();
    const [records, setRecords] = useState<GoldRecord[]>([]);
    const [vaultOrder, setVaultOrder] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [draggedType, setDraggedType] = useState<string | null>(null);
    const [showOutflows, setShowOutflows] = useState<boolean>(() => {
        const stored = localStorage.getItem('vault_showOutflows');
        return stored !== null ? stored === 'true' : true;
    });

    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formOwner, setFormOwner] = useState('');
    const [formGoldType, setFormGoldType] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formNote, setFormNote] = useState('');
    const [formTransactionType, setFormTransactionType] = useState('Birikim');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editOwner, setEditOwner] = useState('');
    const [editGoldType, setEditGoldType] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editNote, setEditNote] = useState('');
    const [editTransactionType, setEditTransactionType] = useState('Birikim');

    useEffect(() => {
        if (isAdmin) {
            loadRecords(true);
        }
    }, [isAdmin]);

    const loadRecords = async (showLoadingState = false) => {
        if (showLoadingState) setIsLoading(true);
        try {
            const res = await fetchWithAuth('/vault');
            if (!res.ok) throw new Error('Veriler getirilemedi.');
            const data = await res.json();
            setRecords(data.records || []);
            if (data.vaultOrder && Array.isArray(data.vaultOrder)) {
                setVaultOrder(data.vaultOrder);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kasa kayıtları yüklenirken hata oluştu.');
        } finally {
            if (showLoadingState) setIsLoading(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, type: string) => {
        setDraggedType(type);
        // Required for Firefox
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetType: string) => {
        e.preventDefault();
        if (!draggedType || draggedType === targetType) {
            setDraggedType(null);
            return;
        }

        const currentTypes = Array.from(new Set(records.map(r => r.gold_type)));

        // Merge the saved vaultOrder with current types to ensure no types are missed
        let orderArray = [...vaultOrder];
        for (const type of currentTypes) {
            if (!orderArray.includes(type)) {
                orderArray.push(type);
            }
        }

        const draggedIdx = orderArray.indexOf(draggedType);
        const targetIdx = orderArray.indexOf(targetType);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            // Optimistic update
            const newOrder = [...orderArray];
            newOrder.splice(draggedIdx, 1);
            newOrder.splice(targetIdx, 0, draggedType);
            setVaultOrder(newOrder);

            // Persist
            try {
                await fetchWithAuth('/vault/order', {
                    method: 'PUT',
                    body: JSON.stringify({ order: newOrder })
                });
            } catch (err) {
                console.error("Sıralama kaydedilemedi", err);
                // Revert if failed
                setVaultOrder(orderArray);
                setError('Sıralama kaydedilemedi.');
            }
        }
        setDraggedType(null);
    };

    useEffect(() => {
        localStorage.setItem('vault_showOutflows', String(showOutflows));
    }, [showOutflows]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formDate || !formOwner || !formGoldType || !formAmount) {
            setError('Tüm alanları doldurunuz.');
            return;
        }

        try {
            const res = await fetchWithAuth('/vault', {
                method: 'POST',
                body: JSON.stringify({
                    record_date: formDate,
                    owner: formOwner,
                    gold_type: formGoldType,
                    amount: parseFloat(formAmount),
                    note: formNote,
                    transaction_type: formTransactionType
                })
            });

            if (!res.ok) throw new Error('Kayıt eklenemedi.');

            // Reset form
            setFormOwner('');
            setFormGoldType('');
            setFormAmount('');

            loadRecords(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetchWithAuth(`/vault/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Kayıt silinemedi.');
            loadRecords(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const startEditing = (record: GoldRecord) => {
        setEditingId(record.id as number);
        // Format date string correctly for input type="date"
        const d = new Date(record.record_date);
        setEditDate(d.toISOString().split('T')[0]);
        setEditOwner(record.owner);
        setEditGoldType(record.gold_type);
        // Clean trailing zeros from decimal (e.g. "1.0000" -> "1")
        setEditAmount(Number(record.amount).toString());
        setEditNote(record.note || '');
        setEditTransactionType(record.transaction_type || 'Birikim');
    };

    const saveEdit = async () => {
        if (!editingId) return;

        try {
            const res = await fetchWithAuth(`/vault/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    record_date: editDate,
                    owner: editOwner,
                    gold_type: editGoldType,
                    amount: parseFloat(editAmount),
                    note: editNote,
                    transaction_type: editTransactionType
                })
            });

            if (!res.ok) throw new Error('Kayıt güncellenemedi.');

            setEditingId(null);
            loadRecords(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    // Default suggestions + any custom types already in the records
    const defaultGoldTypes = ["Gram", "Çeyrek", "Yarım", "Tam", "Ata Lira", "Dolar", "Euro"];
    const uniqueGoldTypes = Array.from(new Set([...defaultGoldTypes, ...records.map(r => r.gold_type)]));

    return (
        <div className="space-y-6">
            <datalist id="goldTypeSuggestions">
                {uniqueGoldTypes.map(type => (
                    <option key={type} value={type} />
                ))}
            </datalist>

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-xl">
                        <Coins size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Kasa</h1>
                        <p className="text-sm text-muted-foreground">Fiziksel birikimlerinizi takip edin.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium cursor-pointer select-none" htmlFor="showOutflows">
                        Gizle/Göster
                    </label>
                    <div className="relative inline-block w-12 mr-2 align-middle select-none">
                        <input
                            type="checkbox"
                            name="showOutflows"
                            id="showOutflows"
                            checked={showOutflows}
                            onChange={(e) => setShowOutflows(e.target.checked)}
                            className="checked:bg-primary outline-none focus:outline-none right-4 checked:right-0 duration-200 ease-in absolute block w-6 h-6 rounded-full bg-white border-4 border-muted appearance-none cursor-pointer"
                        />
                        <label htmlFor="showOutflows" className="block overflow-hidden h-6 rounded-full bg-muted cursor-pointer"></label>
                    </div>
                </div>
            </header>

            {error && (
                <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-sm border border-red-500/20">
                    {error}
                </div>
            )}

            <Card title="Yeni Kayıt Ekle">
                <form onSubmit={handleAdd} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Tarih</label>
                            <input
                                type="date"
                                required
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Kime Ait</label>
                            <input
                                type="text"
                                required
                                placeholder="Örn: Ahmet"
                                value={formOwner}
                                onChange={(e) => setFormOwner(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Cinsi</label>
                            <input
                                type="text"
                                required
                                placeholder="Örn: Gram veya Bosna Markı"
                                list="goldTypeSuggestions"
                                value={formGoldType}
                                onChange={(e) => setFormGoldType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Miktar</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                placeholder="Örn: 1.5"
                                value={formAmount}
                                onChange={(e) => setFormAmount(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">İşlem Türü</label>
                            <select
                                required
                                value={formTransactionType}
                                onChange={(e) => setFormTransactionType(e.target.value)}
                                className={`w-full px-4 py-3 rounded-xl bg-secondary focus:outline-none focus:ring-2 focus:ring-primary appearance-none font-medium ${formTransactionType === 'Birikim' ? 'text-green-600' : formTransactionType === 'Düğün Hediyesi / Takı' ? 'text-muted-foreground' : 'text-red-500'}`}
                            >
                                <option value="Birikim" className="text-green-600">Birikim</option>
                                <option value="Düğün Hediyesi / Takı" className="text-muted-foreground">Düğün Hediyesi / Takı</option>
                                <option value="Borç Verdim" className="text-red-500">Borç Verdim</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Not</label>
                            <input
                                type="text"
                                placeholder="İsteğe Bağlı"
                                value={formNote}
                                onChange={(e) => setFormNote(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
                    >
                        <Plus size={20} /> Kayıt Ekle
                    </button>
                </form>
            </Card>

            <Card title="Kayıtlar">
                {isLoading ? (
                    <div className="text-center text-muted-foreground py-8">Yükleniyor...</div>
                ) : records.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Henüz kayıt eklenmemiş.</div>
                ) : (
                    <div className="space-y-12">
                        {/* Upper Section: Birikimler and Borçlar */}
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary border-b pb-2">
                                Birikimler
                            </h2>
                            <div className="space-y-6">
                                {Array.from(new Set(records.filter(r => (r.transaction_type || 'Birikim') !== 'Düğün Hediyesi / Takı').map(r => r.gold_type)))
                                    .sort((a, b) => {
                                        const idxA = vaultOrder.indexOf(a);
                                        const idxB = vaultOrder.indexOf(b);
                                        if (idxA === -1 && idxB === -1) return 0;
                                        if (idxA === -1) return 1; // Put unknowns at the end
                                        if (idxB === -1) return -1;
                                        return idxA - idxB;
                                    })
                                    .map(goldType => {
                                    const groupRecords = records.filter(r => r.gold_type === goldType && (r.transaction_type || 'Birikim') !== 'Düğün Hediyesi / Takı').sort((a, b) => {
                                        const typeA = a.transaction_type || 'Birikim';
                                        const typeB = b.transaction_type || 'Birikim';

                                        // Birikim first, then Borç Verdim
                                        if (typeA !== typeB) {
                                            return typeA === 'Birikim' ? -1 : 1;
                                        }

                                        const dateA = new Date(a.record_date).getTime();
                                        const dateB = new Date(b.record_date).getTime();
                                        if (dateA !== dateB) return dateB - dateA;
                                        return (b.id || 0) - (a.id || 0);
                                    });

                                    const rawTotalGiris = groupRecords.filter(r => (r.transaction_type || 'Birikim') === 'Birikim').reduce((sum, record) => sum + Number(record.amount), 0);
                                    const totalGiris = Math.max(0, rawTotalGiris);

                                    return (
                                        <div
                                            key={goldType}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, goldType)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, goldType)}
                                            className={`overflow-x-auto bg-card rounded-xl border border-border cursor-move transition-transform ${draggedType === goldType ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}`}
                                        >
                                    <div className="min-w-max">
                                        <div className="p-4 bg-secondary/50 border-b border-border flex items-center justify-between pointer-events-none">
                                            <h3 className="font-bold text-lg pointer-events-auto">{goldType}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">Toplam:</span>
                            <span className="text-lg font-mono font-bold text-green-600">{totalGiris} {goldType}</span>
                                            </div>
                                        </div>
                                        <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap w-[15%]">Tarih</th>
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[20%]">Kime Ait</th>
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[10%]">Tür</th>
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm text-right w-[15%]">Miktar</th>
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[30%]">Not</th>
                                                <th className="py-3 px-4 font-medium text-muted-foreground text-sm text-center w-[10%]">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupRecords.map(record => {
                                                const isEditing = editingId === record.id;
                                                const d = new Date(record.record_date);
                                                const displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : record.record_date;

                                                return (
                                                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                                        {isEditing ? (
                                                            <>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        type="date"
                                                                        value={editDate}
                                                                        onChange={e => setEditDate(e.target.value)}
                                                                        className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        type="text"
                                                                        value={editOwner}
                                                                        onChange={e => setEditOwner(e.target.value)}
                                                                        className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <select
                                                                        value={editTransactionType}
                                                                        onChange={e => setEditTransactionType(e.target.value)}
                                                                        className={`w-full px-2 py-1 rounded bg-background text-sm border border-border font-medium ${editTransactionType === 'Birikim' ? 'text-green-600' : editTransactionType === 'Düğün Hediyesi / Takı' ? 'text-muted-foreground' : 'text-red-500'}`}
                                                                    >
                                                                        <option value="Birikim">Birikim</option>
                                                                        <option value="Düğün Hediyesi / Takı">Düğün Hediyesi / Takı</option>
                                                                        <option value="Borç Verdim">Borç Verdim</option>
                                                                    </select>
                                                                </td>
                                                                <td className="py-3 px-4 text-right">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={editAmount}
                                                                        onChange={e => setEditAmount(e.target.value)}
                                                                        className={`w-full px-2 py-1 rounded bg-background text-sm border border-border text-right font-mono font-bold ${editTransactionType === 'Giriş' ? 'text-primary' : 'text-red-500'}`}
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <input
                                                                        type="text"
                                                                        value={editNote}
                                                                        onChange={e => setEditNote(e.target.value)}
                                                                        className="w-full min-w-[120px] px-2 py-1 rounded bg-background text-sm border border-border"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <div className="flex justify-center gap-2">
                                                                        <button onClick={saveEdit} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg" title="Kaydet">
                                                                            <Check size={16} />
                                                                        </button>
                                                                        <button onClick={cancelEdit} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg" title="İptal">
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="py-3 px-4 text-sm whitespace-nowrap">{displayDate}</td>
                                                                <td className="py-3 px-4 font-medium">{record.owner}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    (record.transaction_type || 'Birikim') === 'Birikim' ? 'bg-green-500/10 text-green-600' : (record.transaction_type === 'Düğün Hediyesi / Takı') ? 'bg-muted text-muted-foreground' : 'bg-red-500/10 text-red-500'
                                                                    }`}>
                                                    {record.transaction_type || 'Birikim'}
                                                                    </span>
                                                                </td>
                                                                <td className={`py-3 px-4 text-right font-mono font-bold ${
                                                (record.transaction_type || 'Birikim') === 'Birikim' ? 'text-green-600' : (record.transaction_type === 'Düğün Hediyesi / Takı') ? 'text-muted-foreground' : 'text-red-500'
                                                                }`}>
                                                {(record.transaction_type === 'Düğün Hediyesi / Takı' || record.transaction_type === 'Borç Verdim') ? '-' : ''}{Number(record.amount)}
                                                                </td>
                                                                <td className="py-3 px-4 text-sm text-muted-foreground break-words max-w-[200px]">{record.note || '-'}</td>
                                                                <td className="py-3 px-4">
                                                                    <div className="flex justify-center gap-2">
                                                                        <button onClick={() => startEditing(record)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Düzenle">
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button onClick={() => handleDelete(record.id as number)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Lower Section: Düğün Hediyeleri */}
                        {showOutflows && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-muted-foreground border-b pb-2">
                                    Dışarıdakiler
                                </h2>
                                <div className="space-y-6">
                                    {Array.from(new Set(records.filter(r => r.transaction_type === 'Düğün Hediyesi / Takı').map(r => r.gold_type)))
                                        .map(goldType => {
                                        const groupRecords = records.filter(r => r.gold_type === goldType && r.transaction_type === 'Düğün Hediyesi / Takı').sort((a, b) => {
                                            const dateA = new Date(a.record_date).getTime();
                                            const dateB = new Date(b.record_date).getTime();
                                            if (dateA !== dateB) return dateB - dateA;
                                            return (b.id || 0) - (a.id || 0);
                                        });

                                        if (groupRecords.length === 0) return null;

                                        return (
                                            <div key={goldType} className="overflow-x-auto bg-card rounded-xl border border-border cursor-default">
                                                <div className="min-w-max">
                                                    <div className="p-4 bg-secondary/50 border-b border-border flex items-center justify-between">
                                                        <h3 className="font-bold text-lg text-muted-foreground">{goldType}</h3>
                                                    </div>
                                                    <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-border bg-muted/30">
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap w-[15%]">Tarih</th>
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[20%]">Kime Ait</th>
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[10%]">Tür</th>
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm text-right w-[15%]">Miktar</th>
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm w-[30%]">Not</th>
                                                            <th className="py-3 px-4 font-medium text-muted-foreground text-sm text-center w-[10%]">İşlem</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groupRecords.map(record => {
                                                            const isEditing = editingId === record.id;
                                                            const d = new Date(record.record_date);
                                                            const displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : record.record_date;

                                                            return (
                                                                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <td className="py-3 px-4">
                                                                                <input
                                                                                    type="date"
                                                                                    value={editDate}
                                                                                    onChange={e => setEditDate(e.target.value)}
                                                                                    className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                                                />
                                                                            </td>
                                                                            <td className="py-3 px-4">
                                                                                <input
                                                                                    type="text"
                                                                                    value={editOwner}
                                                                                    onChange={e => setEditOwner(e.target.value)}
                                                                                    className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                                                />
                                                                            </td>
                                                                            <td className="py-3 px-4">
                                                                                <select
                                                                                    value={editTransactionType}
                                                                                    onChange={e => setEditTransactionType(e.target.value)}
                                                                                    className={`w-full px-2 py-1 rounded bg-background text-sm border border-border font-medium ${editTransactionType === 'Birikim' ? 'text-green-600' : editTransactionType === 'Düğün Hediyesi / Takı' ? 'text-muted-foreground' : 'text-red-500'}`}
                                                                                >
                                                                                    <option value="Birikim">Birikim</option>
                                                                                    <option value="Düğün Hediyesi / Takı">Düğün Hediyesi / Takı</option>
                                                                                    <option value="Borç Verdim">Borç Verdim</option>
                                                                                </select>
                                                                            </td>
                                                                            <td className="py-3 px-4 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={editAmount}
                                                                                    onChange={e => setEditAmount(e.target.value)}
                                                                                    className={`w-full px-2 py-1 rounded bg-background text-sm border border-border text-right font-mono font-bold ${editTransactionType === 'Birikim' ? 'text-green-600' : editTransactionType === 'Düğün Hediyesi / Takı' ? 'text-muted-foreground' : 'text-red-500'}`}
                                                                                />
                                                                            </td>
                                                                            <td className="py-3 px-4">
                                                                                <input
                                                                                    type="text"
                                                                                    value={editNote}
                                                                                    onChange={e => setEditNote(e.target.value)}
                                                                                    className="w-full min-w-[120px] px-2 py-1 rounded bg-background text-sm border border-border"
                                                                                />
                                                                            </td>
                                                                            <td className="py-3 px-4">
                                                                                <div className="flex justify-center gap-2">
                                                                                    <button onClick={saveEdit} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg" title="Kaydet">
                                                                                        <Check size={16} />
                                                                                    </button>
                                                                                    <button onClick={cancelEdit} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg" title="İptal">
                                                                                        <X size={16} />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <td className="py-3 px-4 text-sm whitespace-nowrap">{displayDate}</td>
                                                                            <td className="py-3 px-4 font-medium">{record.owner}</td>
                                                                            <td className="py-3 px-4">
                                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground`}>
                                                                                    Düğün Hediyesi / Takı
                                                                                </span>
                                                                            </td>
                                                                            <td className={`py-3 px-4 text-right font-mono font-bold text-muted-foreground`}>
                                                                                -{Number(record.amount)}
                                                                            </td>
                                                                            <td className="py-3 px-4 text-sm text-muted-foreground break-words max-w-[200px]">{record.note || '-'}</td>
                                                                            <td className="py-3 px-4">
                                                                                <div className="flex justify-center gap-2">
                                                                                    <button onClick={() => startEditing(record)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title="Düzenle">
                                                                                        <Edit2 size={16} />
                                                                                    </button>
                                                                                    <button onClick={() => handleDelete(record.id as number)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
                                                                                        <Trash2 size={16} />
                                                                                    </button>
                                                                                </div>
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
