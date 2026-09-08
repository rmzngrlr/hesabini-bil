import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useBudget } from '../context/BudgetContext';

const formatMonth = (dateStr: string) => {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

/**
 * Bilanço'daki ay değiştirme barının ortak sürümü. Tüm sayfalarda aynı görünüm/konum.
 * viewDate + earliestAllowedMonth + setViewDate context'ten okunur (tek kaynak).
 * onDoubleClick verilirse (yalnız İşlemler + Kredi Kartı Borcu sayfaları) tarih kısmına
 * çift tıklama onu tetikler (takvim görünümünü açar/kapatır); ‹ › oklarını etkilemez.
 */
export function MonthNavigator({ onDoubleClick }: { onDoubleClick?: () => void } = {}) {
  const { viewDate, setViewDate, earliestAllowedMonth } = useBudget();

  const changeMonth = (delta: number) => {
    let [y, m] = viewDate.split('-').map(Number);
    m += delta;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    setViewDate(`${y}-${String(m).padStart(2, '0')}`);
  };

  return (
    <div className="flex justify-between items-center bg-secondary/30 rounded-xl p-2">
      <button
        onClick={() => changeMonth(-1)}
        disabled={viewDate <= earliestAllowedMonth}
        className={`p-2 rounded-lg transition-colors ${viewDate <= earliestAllowedMonth ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'hover:bg-secondary'}`}
      >
        <ChevronLeft size={20} />
      </button>

      <div
        className={`flex flex-col items-center ${onDoubleClick ? 'cursor-pointer select-none' : ''}`}
        onDoubleClick={onDoubleClick}
        title={onDoubleClick ? 'Takvim görünümü için çift tıklayın' : undefined}
      >
        <div className="flex items-center gap-2 font-medium text-lg">
          <Calendar size={18} className="text-primary" />
          <span className="capitalize w-32 text-center">{formatMonth(viewDate)}</span>
        </div>
      </div>

      <button onClick={() => changeMonth(1)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
