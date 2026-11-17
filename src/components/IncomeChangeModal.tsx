import React, { useEffect, useState } from 'react';

interface IncomeChangeModalProps {
  isOpen: boolean;
  /** true: ana "Aylık Gelir" (önce Maaş/Değişken sorulur). false: Yemek Kartı geliri (değişken yok, doğrudan 6/12). */
  allowVariable: boolean;
  /** Başlık altında gösterilecek yeni tutar metni (opsiyonel). */
  amountLabel?: string;
  /** months=1 -> yalnız bu ay (değişken); 6/12 -> maaş (bu ay dahil ileri). */
  onApply: (months: number) => void;
  onCancel: () => void;
}

/**
 * Gelir değişikliği onayı. Ana gelir: "Maaş mı, Değişken gelir mi?" -> maaş ise "6 ay / 12 ay".
 * Yemek kartı gelirinde değişken gelir yoktur -> doğrudan "6 ay / 12 ay" sorulur.
 */
export const IncomeChangeModal: React.FC<IncomeChangeModalProps> = ({
  isOpen,
  allowVariable,
  amountLabel,
  onApply,
  onCancel,
}) => {
  const [step, setStep] = useState<'kind' | 'duration'>(allowVariable ? 'kind' : 'duration');

  // Her açılışta ilk adıma dön (ana gelir -> 'kind', YK -> 'duration').
  useEffect(() => {
    if (isOpen) setStep(allowVariable ? 'kind' : 'duration');
  }, [isOpen, allowVariable]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const amountNote = amountLabel ? (
    <>Yeni tutar <strong className="text-foreground">{amountLabel}</strong>. </>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative text-card-foreground p-6 rounded-2xl border glass-blur shadow-2xl max-w-[340px] sm:max-w-[380px] w-full flex flex-col items-center text-center mx-4">
        <div className="w-16 h-16 rounded-full border-2 border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4 bg-emerald-50/10 dark:bg-emerald-500/5">
          <span className="font-sans font-semibold text-3xl leading-none select-none">₺</span>
        </div>

        {step === 'kind' ? (
          <>
            <h3 className="text-xl font-bold tracking-tight mb-1">Gelir değişikliği</h3>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed max-w-[280px]">
              {amountNote}Bu bir maaş mı, yoksa yalnız bu aya özel değişken gelir mi?
            </p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => setStep('duration')}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm active:scale-[0.98]"
              >
                Maaş
              </button>
              <button
                onClick={() => onApply(1)}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-all active:scale-[0.98]"
              >
                Değişken gelir (yalnız bu ay)
              </button>
              <button
                onClick={onCancel}
                className="w-full px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground text-sm transition-all"
              >
                İptal
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold tracking-tight mb-1">
              {allowVariable ? 'Maaş değişim süresi' : 'Gelir değişim süresi'}
            </h3>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed max-w-[280px]">
              {amountNote}Bu ay dahil kaç ay boyunca geçerli olsun?
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => onApply(6)}
                className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
              >
                6 ay
              </button>
              <button
                onClick={() => onApply(12)}
                className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
              >
                12 ay
              </button>
            </div>
            <div className="flex gap-2 w-full mt-2">
              {allowVariable && (
                <button
                  onClick={() => setStep('kind')}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm transition-all"
                >
                  Geri
                </button>
              )}
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground text-sm transition-all"
              >
                İptal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
