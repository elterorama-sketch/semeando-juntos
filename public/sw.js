// Minimal service worker: registers the app as installable. We deliberately
// do not cache API/data responses -- selling numbers offline could cause the
// exact concurrency conflicts the backend is built to prevent (see
// reserve_numbers() in supabase/migrations), so this app is online-only by
// design.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Always go to the network; no offline fallback for data requests.
});
