import { useLayoutEffect } from 'react';

/**
 * Gercek gorunur alan yuksekligini (visualViewport.height, yoksa innerHeight)
 * olcup --app-vh CSS degiskenine yazar. CSS dvh/lvh mobil adres cubugu
 * oynamalarinda guvenilmez oldugundan (altta bosluk / gereksiz scroll / esneme)
 * JS olcumu kullanilir. Adres cubugu / donme / klavye ile boyut degisince
 * guncellenir; deger degismediyse yazilmaz (gereksiz reflow yok).
 *
 * Uygulama kok bileseninde (App) bir kez cagrilir -> hem giris/kayit sayfalari
 * hem de Layout icin --app-vh her yerde tanimli olur.
 */
export function useViewportHeightVar() {
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    let last = -1;
    const setAppVh = () => {
      const h = Math.round(vv ? vv.height : window.innerHeight);
      if (h === last) return;
      last = h;
      document.documentElement.style.setProperty('--app-vh', `${h}px`);
    };
    setAppVh();
    window.addEventListener('resize', setAppVh);
    vv?.addEventListener('resize', setAppVh);
    return () => {
      window.removeEventListener('resize', setAppVh);
      vv?.removeEventListener('resize', setAppVh);
    };
  }, []);
}
