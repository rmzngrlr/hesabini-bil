import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, Check } from 'lucide-react';

const VIEW = 256; // kirpma penceresi (ekranda gorunen kare)
const OUT = 160;  // kaydedilen kare avatar boyutu (px)

interface Props {
  /** Kullanicinin sectigi resim dosyasi. */
  file: File;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

/**
 * Sosyal medya tarzi avatar kirpma: fotografi surukle + yakinlastir,
 * daire icinde gorunecek alani sec, 160x160 kare JPEG olarak kaydet.
 */
export function AvatarCropModal({ file, onCancel, onSave }: Props) {
  const [imageUrl, setImageUrl] = useState('');
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1); // ekstra yakinlastirma (1..3)
  const [pos, setPos] = useState({ x: 0, y: 0 }); // px, kare merkezine gore
  const [error, setError] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // scale=1'de resmin kareyi tam kaplamasi icin taban olcek
  const baseScale = nat ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1;
  const imgW = nat ? nat.w * baseScale * scale : VIEW;
  const imgH = nat ? nat.h * baseScale * scale : VIEW;

  const clamp = (x: number, y: number) => {
    const maxX = Math.max(0, (imgW - VIEW) / 2);
    const maxY = Math.max(0, (imgH - VIEW) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  // Yakinlastirma degisince konumu yeniden sinirla (bosluk gorunmesin)
  useEffect(() => {
    setPos(p => clamp(p.x, p.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, nat]);

  const onImgLoad = () => {
    const el = imgRef.current;
    if (el && el.naturalWidth > 0) {
      setNat({ w: el.naturalWidth, h: el.naturalHeight });
      setError('');
    }
  };

  const onImgError = () => {
    setError('Bu görüntü biçimi desteklenmiyor. Lütfen JPG veya PNG bir fotoğraf seçin.');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!nat) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPos(clamp(d.px + (e.clientX - d.x), d.py + (e.clientY - d.y)));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleSave = () => {
    const el = imgRef.current;
    if (!el || !nat) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUT, OUT);
    const k = OUT / VIEW;
    const left = (VIEW - imgW) / 2 + pos.x;
    const top = (VIEW - imgH) / 2 + pos.y;
    ctx.drawImage(el, left * k, top * k, imgW * k, imgH * k);
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  };

  const left = (VIEW - imgW) / 2 + pos.x;
  const top = (VIEW - imgH) / 2 + pos.y;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Fotoğrafı konumlandır</h2>
          <button
            onClick={onCancel}
            aria-label="Kapat"
            className="p-1.5 rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Daire, avatarda görünecek alandır. Sürükle, çubukla yakınlaştır.</p>

        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3 mb-4">{error}</div>
        )}

        <div className="flex justify-center mb-4">
          <div
            className="relative overflow-hidden rounded-xl bg-secondary touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {imageUrl && (
              <img
                ref={imgRef}
                src={imageUrl}
                onLoad={onImgLoad}
                onError={onImgError}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${imgW}px`,
                  height: `${imgH}px`,
                  maxWidth: 'none',
                }}
              />
            )}
            {/* Daire disini karart + beyaz halka: yuvarlak avatar onizlemesi */}
            <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <ZoomIn size={18} className="text-muted-foreground shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
            disabled={!nat}
            aria-label="Yakınlaştır"
            className="w-full accent-primary"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!nat}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Check size={16} /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
