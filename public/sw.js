const CACHE_NAME = "mchat-v1";
const urlsToCache = ["/", "/index.html"];

// Install
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // Ignore if offline during install
      });
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", e => {
  // Skip API calls and external resources
  if (e.request.url.includes("/api/") || e.request.url.includes("cdnjs") || e.request.url.includes("mistral") || e.request.url.includes("tavily")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(response => {
      if (response) return response;
      return fetch(e.request).then(response => {
        // Cache successful responses
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Offline fallback
        return caches.match("/index.html");
      });
    })
  );
});
