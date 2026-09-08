import { useMemo, useState, useEffect } from 'react';
import { ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { Secret } from './Secret';

export interface CalendarEntry {
  date: string; // 'YYYY-MM-DD'
  amount: number;
}

/**
 * İşlemler ve Kredi Kartı Borcu sayfalarındaki günlük liste yerine (tarih barına çift
 * tıklayınca) gösterilen takvim görünümü. Ay = viewDate (bar ile değişir). Haftalar
 * PAZARTESİ başlar; hafta sonu (Cmt/Paz) yalnız tarih rengi farklıdır. Her günün altında
 * seçili varlığın o günkü değeri: 'Harcama' (yalnız çıkışlar) veya 'Net' (giriş−çıkış).
 * Tek gün ya da aralık seçilir; altta "tarih: toplam + cins" özeti çıkar. Girdiler
 * (entries) çağıran sayfadan gelir; hangi varlık/bağlam olduğunu sayfa belirler (symbol/label).
 * Listeye dönüş: tarih barına yeniden çift tıklama (bu görünüm ile liste arasında toggle).
 */
export function SpendingCalendar({
  viewDate,
  entries,
  symbol,
  label,
}: {
  viewDate: string;
  entries: CalendarEntry[];
  symbol: string;
  label: string;
}) {
  const [mode, setMode] = useState<'harcama' | 'net'>('harcama');
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);

  const [year, month] = viewDate.split('-').map(Number); // month: 1-12

  // Ay değişince (bar ‹ ›) seçim geçersiz kalmasın diye sıfırla (ör. 31 → 30 günlük ay).
  useEffect(() => { setStart(null); setEnd(null); }, [viewDate]);

  // Görüntülenen AYIN günlerine göre topla: spend = çıkışlar (mutlak), net = tüm hareket.
  // Ay dışı / eksik tarihli kayıtlar (ör. KK kesim günü nedeniyle önceki aya tarihli ama bu
  // ekstrede olan harcamalar) gride yanlış güne düşmesin diye AYRI sayılır; sessizce düşmesin
  // diye altta dipnotla belirtilir. Böylece hücre toplamları doğru, hiçbir kayıt gizlenmez.
  const { perDay, otherCount, otherSpend, otherNet } = useMemo(() => {
    const m: Record<number, { spend: number; net: number }> = {};
    let oCount = 0, oSpend = 0, oNet = 0;
    entries.forEach(e => {
      const inMonth = !!e.date && e.date.length >= 7 && e.date.slice(0, 7) === viewDate;
      if (inMonth) {
        const day = Number(e.date.slice(8, 10));
        if (!Number.isFinite(day)) return;
        if (!m[day]) m[day] = { spend: 0, net: 0 };
        m[day].net += e.amount;
        if (e.amount < 0) m[day].spend += -e.amount;
      } else if (e.date && e.amount) {
        oCount++;
        oNet += e.amount;
        if (e.amount < 0) oSpend += -e.amount;
      }
    });
    return { perDay: m, otherCount: oCount, otherSpend: oSpend, otherNet: oNet };
  }, [entries, viewDate]);

  const valOf = (day: number) => {
    const d = perDay[day];
    if (!d) return 0;
    return mode === 'harcama' ? d.spend : d.net;
  };
  const otherTotal = mode === 'harcama' ? otherSpend : otherNet;

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstCol = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Pazartesi = 0
  const isWeekend = (day: number) => {
    const wd = new Date(year, month - 1, day).getDay();
    return wd === 0 || wd === 6;
  };
  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;

  const selRange = () => {
    if (start == null) return null;
    const hi = end == null ? start : end;
    return { lo: Math.min(start, hi), hi: Math.max(start, hi) };
  };
  const inSel = (day: number): 0 | 1 | 2 => {
    const r = selRange();
    if (!r) return 0;
    if (day < r.lo || day > r.hi) return 0;
    return day === r.lo || day === r.hi ? 2 : 1;
  };

  const pick = (day: number) => {
    if (start == null) { setStart(day); setEnd(null); }
    else if (end == null) { if (day === start) { setStart(null); setEnd(null); } else setEnd(day); }
    else { setStart(day); setEnd(null); }
  };

  const fmt = (n: number) => Math.abs(n).toLocaleString('tr-TR');
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long' });

  const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const cells: number[] = [];
  for (let i = 0; i < firstCol; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);

  const r = selRange();
  let summaryTotal = 0;
  if (r) for (let d = r.lo; d <= r.hi; d++) summaryTotal += valOf(d);
  const summaryLabel = r
    ? (r.lo === r.hi ? `${r.lo} ${monthName} ${year}` : `${r.lo}–${r.hi} ${monthName} ${year}`)
    : '';

  const modeBtn = (m: 'harcama' | 'net', text: string, Icon: typeof ArrowDownRight) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
        mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon size={15} /> {text}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {modeBtn('harcama', 'Harcama', ArrowDownRight)}
        {modeBtn('net', 'Net', ArrowLeftRight)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekdays.map((w, i) => (
          <div key={w} className={`text-center text-xs py-1 ${i >= 5 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, idx) => {
          if (day === 0) return <div key={`e${idx}`} />;
          const sel = inSel(day);
          const v = valOf(day);
          const weekend = isWeekend(day);
          const isPos = v > 0 && mode === 'net';
          return (
            <button
              key={day}
              type="button"
              onClick={() => pick(day)}
              className={`min-h-[52px] rounded-xl border flex flex-col items-center justify-start gap-0.5 pt-1.5 pb-1 px-1 transition-colors ${
                sel === 2
                  ? 'bg-primary border-primary text-primary-foreground'
                  : sel === 1
                  ? 'bg-primary/15 border-primary/30'
                  : isToday(day)
                  ? 'bg-secondary/40 border-primary/60'
                  : 'bg-secondary/40 border-border hover:bg-secondary'
              }`}
            >
              <span className={`text-sm font-semibold leading-none ${
                sel === 2 ? '' : weekend ? 'text-red-500' : 'text-foreground'
              }`}>
                {day}
              </span>
              {v !== 0 ? (
                <span className={`text-[10px] leading-tight ${
                  sel === 2 ? '' : isPos ? 'text-green-500' : 'text-red-500'
                }`}>
                  <Secret>{isPos ? '+' : ''}{fmt(v)}</Secret>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground leading-none">·</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl bg-primary/10 border border-primary/25 px-4 py-3 min-h-[48px] flex items-center">
        {r ? (
          <div className="text-sm">
            <span className="text-muted-foreground">{summaryLabel}: </span>
            <span className={`font-semibold ${mode === 'net' ? (summaryTotal > 0 ? 'text-green-500' : summaryTotal < 0 ? 'text-red-500' : '') : ''}`}>
              {mode === 'net' && summaryTotal > 0 ? '+' : mode === 'net' && summaryTotal < 0 ? '-' : ''}
              <Secret>{fmt(summaryTotal)}</Secret> {symbol}
            </span>
            <span className="text-muted-foreground text-xs">
              {' · '}{label}{' · '}{mode === 'harcama' ? 'harcama' : 'net'}
              {r.lo !== r.hi ? ` · ${r.hi - r.lo + 1} gün` : ''}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Bir gün ya da aralık seçin.</span>
        )}
      </div>

      {otherCount > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Bu ayın dışında tarihli işlemler listede var (takvimde gösterilmez):{' '}
          {mode === 'net' && otherTotal > 0 ? '+' : mode === 'net' && otherTotal < 0 ? '-' : ''}
          <Secret>{fmt(otherTotal)}</Secret> {symbol}
        </div>
      )}
    </div>
  );
}
