import type { InputHTMLAttributes } from 'react';
import { usePrivacy } from '../context/PrivacyContext';

/**
 * Deger gizleme modunda input'un DEGERINI de maskeler. `Secret` yalniz metin
 * cocuklarini maskeler; input'un gosterdigi deger `value` prop'udur (cocuk degil),
 * bu yuzden duzenlenebilir para alanlari (or. Aylik Gelir, Devreden) gizleme
 * moduyla kaybolmuyordu. Gizliyken: type="text" + "••••" + readOnly (maskeli metnin
 * yanlislikla gercek degeri ezmesini onler; onChange devre disi). Acikken: normal
 * input (props oldugu gibi). Yalniz gorunum — hicbir degeri/hesaplamayi degistirmez.
 */
export function SecretInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { hidden } = usePrivacy();
  if (!hidden) return <input {...props} />;
  return (
    <input
      {...props}
      type="text"
      value="••••"
      readOnly
      onChange={undefined}
      aria-hidden="true"
      style={{ ...(props.style || {}), userSelect: 'none' }}
    />
  );
}
