import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA guncelleme bildirimi. SW `registerType: 'prompt'` (bkz. vite.config.ts) oldugu icin yeni
 * surum yayinlandiginda otomatik devralmaz; bunun yerine burada alttan bir kart cikar ve kullanici
 * "Güncelle"ye basinca `updateServiceWorker(true)` bekleyen SW'yi devralip sayfayi yeni paketle
 * yeniden yukler. Standalone PWA uzun sure acik kalabildiginden periyodik olarak da guncelleme
 * kontrol edilir (aksi halde "sunucu guncel ama uygulama eski paketi gosteriyor" durumu olusur).
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Saatte bir yeni surum var mi diye bak (uygulama acik kalsa bile yakalansin).
      setInterval(() => {
        registration.update().catch(() => { /* cevrimdisi vb. -> yoksay */ });
      }, 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border glass-blur shadow-2xl p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground">Yeni sürüm hazır</div>
          <div className="text-sm text-muted-foreground">Uygulamayı güncellemek için dokunun.</div>
        </div>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="h-10 px-3 rounded-xl text-muted-foreground hover:bg-secondary transition-colors text-sm font-medium shrink-0"
        >
          Sonra
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm shrink-0"
        >
          Güncelle
        </button>
      </div>
    </div>
  );
}
