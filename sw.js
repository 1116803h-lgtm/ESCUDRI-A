/* Escudriñad — service worker
   Estrategia:
   · Precarga un núcleo mínimo (index, manifest, íconos) al instalar.
   · El resto (versiones JSON, léxico Strong, sql.js…) se cachea la
     primera vez que se usa (cache-first con respaldo de red).
   Así la app funciona sin conexión tras la primera visita, sin
     forzar la descarga de archivos grandes al instalar.               */
var CACHE = 'escudrinad-v11';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'data/versions.json',
  'data/ley_cristo.json',
  'data/doctrinas.json',
  'data/mapas.json',
  'mapas/escatologico.svg',
  'mapas/dispensaciones.svg'
];
// Nota: las versiones de Biblia (RV1960.json, LBLA.json, Vulgata.json, etc.),
// el léxico Strong y sql.js NO se precargan aquí porque son grandes. Cada una se
// guarda en caché automáticamente la PRIMERA vez que se abre (cache-first con
// respaldo de red), así la instalación es ligera y luego quedan disponibles sin
// conexión. Para tener todas offline, ábrelas una vez estando con internet.

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // add() individual para que un 404 no rompa toda la instalación
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo mismo origen

  // Navegación: intenta red, cae a index.html cacheado (offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Recursos: cache-first, y guarda en caché lo que baje de la red
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
