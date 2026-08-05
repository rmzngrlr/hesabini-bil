import { cn } from '../../lib/utils';

interface AvatarProps {
  /** Profil fotografi (data URL). Yoksa bas harf gosterilir. */
  src?: string | null;
  /** Fotograf yoksa gosterilecek bas harf. */
  initial: string;
  /** Boyut ve yazi tipini iceren siniflar, or. "w-8 h-8 text-xs". */
  className?: string;
  title?: string;
}

/**
 * Kullanici avatari: fotograf varsa yuvarlak <img>, yoksa primary renkte bas harf.
 * Uygulamadaki tum avatar noktalari (mobil menu, masaustu sol menu, ayarlar) bunu kullanir.
 */
export function Avatar({ src, initial, className, title }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt="Profil fotoğrafı"
        title={title}
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    );
  }

  return (
    <div
      title={title}
      className={cn(
        'rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold shrink-0',
        className
      )}
    >
      {initial}
    </div>
  );
}
