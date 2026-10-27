/* Corlemps service worker: offline + notifikasyon */
var CACHE = 'corlemps-v2';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var LIB = 'https://cdn.jsdelivr.net/';
var SUPA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
var TIMEOUT = 4000; /* si rezo a pa reponn nan 4 segonn, sèvi ak vèsyon ki sove a */

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    var jobs = SHELL.map(function (u) { return c.add(u).catch(function () {}); });
    /* Bibliyotèk Supabase a dwe nan cache dèske SW la enstale, sinon app la pa ka louvri offline */
    jobs.push(c.add(new Request(SUPA, { mode: 'no-cors' })).catch(function () {}));
    return Promise.all(jobs);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (m) {
    if (m) return m;
    if (req.mode === 'navigate') return caches.match('index.html').then(function (x) { return x || caches.match('./'); });
    return undefined;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isLib = req.url.indexOf(LIB) === 0;
  /* Pa janm kenbe done Supabase (API, auth, storage, realtime) */
  if (!sameOrigin && !isLib) return;

  e.respondWith(new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      fromCache(req).then(function (m) { if (m && !done) { done = true; resolve(m); } });
    }, TIMEOUT);
    fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (m) {
        if (!done) { done = true; resolve(m || Response.error()); }
      });
    });
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  }));
});
