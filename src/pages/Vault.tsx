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
}

export default function Vault() {
    const { isAdmin } = useAuth();
    const [records, setRecords] = useState<GoldRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formOwner, setFormOwner] = useState('');
    const [formGoldType, setFormGoldType] = useState('');
    const [formAmount, setFormAmount] = useState('');

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editOwner, setEditOwner] = useState('');
    const [editGoldType, setEditGoldType] = useState('');
    const [editAmount, setEditAmount] = useState('');

    useEffect(() => {
        if (isAdmin) {
            loadRecords();
        }
    }, [isAdmin]);

    const loadRecords = async () => {
        setIsLoading(true);
        try {
            const res = await fetchWithAuth('/vault');
            if (!res.ok) throw new Error('Veriler getirilemedi.');
            const data = await res.json();
            setRecords(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kasa kayıtları yüklenirken hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

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
                    amount: parseFloat(formAmount)
                })
            });

            if (!res.ok) throw new Error('Kayıt eklenemedi.');

            // Reset form
            setFormOwner('');
            setFormGoldType('');
            setFormAmount('');

            loadRecords();
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
            loadRecords();
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
        setEditAmount(record.amount.toString());
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
                    amount: parseFloat(editAmount)
                })
            });

            if (!res.ok) throw new Error('Kayıt güncellenemedi.');

            setEditingId(null);
            loadRecords();
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

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <div className="p-3 bg-yellow-500/20 text-yellow-500 rounded-xl">
                    <Coins size={28} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kasa (Altın Takibi)</h1>
                    <p className="text-sm text-muted-foreground">Fiziksel birikimlerinizi takip edin.</p>
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
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarih</label>
                            <input
                                type="date"
                                required
                                value={formDate}
                                onChange={(e) => setFormDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kime Ait</label>
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
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cinsi</label>
                            <input
                                type="text"
                                required
                                placeholder="Örn: Çeyrek Altın"
                                value={formGoldType}
                                onChange={(e) => setFormGoldType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Miktar</label>
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="pb-3 px-2 font-medium text-muted-foreground text-sm whitespace-nowrap">Tarih</th>
                                    <th className="pb-3 px-2 font-medium text-muted-foreground text-sm">Kime Ait</th>
                                    <th className="pb-3 px-2 font-medium text-muted-foreground text-sm">Cinsi</th>
                                    <th className="pb-3 px-2 font-medium text-muted-foreground text-sm text-right">Miktar</th>
                                    <th className="pb-3 px-2 font-medium text-muted-foreground text-sm text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(record => {
                                    const isEditing = editingId === record.id;
                                    const d = new Date(record.record_date);
                                    const displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('tr-TR') : record.record_date;

                                    return (
                                        <tr key={record.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                            {isEditing ? (
                                                <>
                                                    <td className="py-3 px-2">
                                                        <input
                                                            type="date"
                                                            value={editDate}
                                                            onChange={e => setEditDate(e.target.value)}
                                                            className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <input
                                                            type="text"
                                                            value={editOwner}
                                                            onChange={e => setEditOwner(e.target.value)}
                                                            className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <input
                                                            type="text"
                                                            value={editGoldType}
                                                            onChange={e => setEditGoldType(e.target.value)}
                                                            className="w-full px-2 py-1 rounded bg-background text-sm border border-border"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={editAmount}
                                                            onChange={e => setEditAmount(e.target.value)}
                                                            className="w-full px-2 py-1 rounded bg-background text-sm border border-border text-right"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-2">
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
                                                    <td className="py-3 px-2 text-sm whitespace-nowrap">{displayDate}</td>
                                                    <td className="py-3 px-2 font-medium">{record.owner}</td>
                                                    <td className="py-3 px-2">{record.gold_type}</td>
                                                    <td className="py-3 px-2 text-right font-mono font-bold text-primary">{record.amount}</td>
                                                    <td className="py-3 px-2">
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
                )}
            </Card>
        </div>
    );
}
