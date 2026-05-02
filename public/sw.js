// Service worker for Pinto Legal OS PWA
// Minimal — enables "Add to Home Screen" prompt
// Cache strategy can be added later for offline support

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass through — no caching for demo
  event.respondWith(fetch(event.request));
});
