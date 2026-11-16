// Service worker: aplicația merge și fără internet după prima deschidere.
const CACHE = 'bugetul-meu-1.2'; // schimbă la fiecare versiune
const SHELL = ['./', './index.html', './styles.css', './app.js', './bank.js', './manifest.json',
  './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // fișierele aplicației: întâi rețeaua (ca să primești update-uri), apoi cache-ul dacă ești offline
    e.respondWith(fetch(req, {cache: 'no-cache'}).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html'))));
  } else if (/jsdelivr|tessdata|projectnaptha/.test(url.host)) {
    // cititorul de bonuri (Tesseract) și dicționarul de română: păstrate după prima descărcare
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
