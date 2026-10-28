import { X } from 'lucide-react';
import { Secret } from './Secret';

/**
 * Coklu secim modunda ekranin altinda (mobilde alt navigasyonun uzerinde)
 * beliren cubuk: "N secili" + net toplam + kapat (✕). Net toplam zaten
 * bicimlenmis metin olarak gelir (isaret + birim dahil); yalniz sayilar
 * gizlilik modunda Secret ile maskelenir.
 */
export function SelectionBar({ count, amountText, onClose }: {
  count: number;
  amountText: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed left-0 right-0 bottom-[4.5rem] md:bottom-4 z-50 px-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary text-primary-foreground shadow-xl ring-1 ring-black/10">
        <div className="min-w-0">
          <div className="text-xs font-medium opacity-80">{count} seçili</div>
          <div className="text-lg font-bold truncate">
            Net toplam: <Secret>{amountText}</Secret>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Seçimi kapat"
          className="shrink-0 p-2 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
