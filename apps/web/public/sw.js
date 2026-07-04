var CACHE = 'spositive-v1';
var ASSETS = ['/', '/offline.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }).then(function() { return self.skipWaiting(); }),
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }),
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('/api/') > -1 || e.request.url.indexOf('supabase') > -1) {
    e.respondWith(networkFirst(e.request));
  } else {
    e.respondWith(cacheFirst(e.request));
  }
});

function cacheFirst(req) {
  return caches.match(req).then(function(cached) {
    if (cached) return cached;
    return fetch(req).then(function(res) {
      if (res.ok) {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(req, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    });
  });
}

function networkFirst(req) {
  return fetch(req).then(function(res) {
    if (res.ok) {
      var clone = res.clone();
      caches.open(CACHE).then(function(c) { c.put(req, clone); });
    }
    return res;
  }).catch(function() {
    return caches.match(req) || new Response('Offline', { status: 503 });
  });
}
