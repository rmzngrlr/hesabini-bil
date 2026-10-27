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

    // Klavye acilinca / odak degisince odaklanan input'u gorunur alana kaydir.
    // interactive-widget=resizes-content ile layout kuculur ama tarayici bazen odakli
    // alani kaydirmaz -> input klavyenin ARKASINDA kalir. Burada elle kaydiriyoruz.
    const isEditable = (el: Element | null): el is HTMLElement =>
      !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (isEditable(el)) {
        try { el.scrollIntoView({ block: 'center' }); } catch { /* yoksay */ }
      }
    };
    // Yeni bir input'a odaklaninca (klavye yeni acilir ya da zaten acikken input degisir):
    // klavye animasyonu + layout kuculmesinden sonra kaydir.
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target as Element)) setTimeout(scrollFocusedIntoView, 300);
    };
    // Klavye acildiginda (gorunur alan KUCULUNCE) odakli input'u hemen gorunur yap (hassas an).
    const onVvResize = () => {
      const prev = last;
      setAppVh();
      if (prev !== -1 && last < prev) setTimeout(scrollFocusedIntoView, 60);
    };

    window.addEventListener('resize', setAppVh);
    vv?.addEventListener('resize', onVvResize);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('resize', setAppVh);
      vv?.removeEventListener('resize', onVvResize);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);
}
