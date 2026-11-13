/*
 * Hesabını Bil! — Web Push service worker eklentisi.
 *
 * vite-plugin-pwa (generateSW) tarafından üretilen sw.js içine `importScripts` ile alınır
 * (bkz. vite.config.ts -> workbox.importScripts). Yalnız push ALMA ve bildirime TIKLAMA
 * olaylarını ekler; önbellekleme / "Güncelle" akışına hiç dokunmaz.
 *
 * NOT: Düz JS (TypeScript değil) ve public/ altında -> olduğu gibi yayınlanır.
 */

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  var title = data.title || 'Hesabını Bil!';
  // Sagdaki buyuk ikon ISTENMIYOR. 'icon' tamamen cikarilinca Android otomatik bir harf
  // monogrami (or. "H") koyuyor; bunu bastirmak icin SEFFAF 1x1 PNG veriyoruz -> sagda
  // gorsel cikmaz. Sol kucuk ikon 'badge' (beyaz ₺ siluet, durum cubugu/kucuk ikon).
  var options = {
    body: data.body || '',
    icon: '/transparent.png',
    badge: '/badge-96.png',
    tag: data.tag || 'hesabini-bil',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Açık bir pencere varsa odakla (ve mümkünse hedef yola git).
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client && targetUrl) {
              try {
                client.navigate(targetUrl);
              } catch (e) {
                /* yoksay */
              }
            }
            return;
          }
        }
        // Açık pencere yoksa yenisini aç.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
