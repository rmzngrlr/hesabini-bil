import React, { useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />

      {/* Modal Container */}
      <div className="relative bg-card text-card-foreground p-8 rounded-2xl border border-border shadow-2xl max-w-sm w-full flex flex-col items-center text-center transform scale-100 transition-all duration-300">
        
        {/* Warning Icon (Exclamation inside Circle) */}
        <div className="w-20 h-20 rounded-full border-2 border-orange-300 dark:border-orange-500/30 flex items-center justify-center text-orange-400 dark:text-orange-400 mb-6 bg-orange-50/20 dark:bg-orange-500/5">
          <span className="text-orange-400 dark:text-orange-400 font-sans font-light text-5xl leading-none select-none -mt-1">!</span>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-semibold tracking-tight mb-3">
          {title}
        </h3>

        {/* Message */}
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed max-w-xs">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center w-full">
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            Evet, Onaylıyorum!
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};
