import React, { useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 'confirm' (varsayilan): Evet/İptal. 'info': tek "Tamam" butonu (bilgi/uyari mesaji). */
  variant?: 'confirm' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  variant = 'confirm',
}) => {
  const isInfo = variant === 'info';

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && isInfo) onConfirm();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, isInfo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />

      {/* Modal Container */}
      <div className="relative text-card-foreground p-6 rounded-2xl border glass-blur shadow-2xl max-w-[320px] sm:max-w-[340px] w-full flex flex-col items-center text-center transform scale-100 transition-all duration-300 mx-4">

        {/* Icon: info -> mavi "i", confirm -> turuncu "!" */}
        {isInfo ? (
          <div className="w-16 h-16 rounded-full border-2 border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-500 mb-4 bg-blue-50/10 dark:bg-blue-500/5">
            <span className="font-sans font-light text-4xl leading-none select-none -mt-0.5">i</span>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-full border-2 border-orange-200 dark:border-orange-500/20 flex items-center justify-center text-orange-400 dark:text-orange-500 mb-4 bg-orange-50/10 dark:bg-orange-500/5">
            <span className="text-orange-400 dark:text-orange-500 font-sans font-light text-4xl leading-none select-none -mt-0.5">!</span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl font-bold tracking-tight mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed max-w-[260px]">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center w-full">
          {isInfo ? (
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm focus:outline-none active:scale-[0.98]"
            >
              Tamam
            </button>
          ) : (
            <>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm focus:outline-none active:scale-[0.98]"
              >
                Evet, Onaylıyorum!
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all shadow-sm focus:outline-none active:scale-[0.98]"
              >
                İptal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
