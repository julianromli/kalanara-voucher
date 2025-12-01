// No-op service worker - prevents 404 errors from browser auto-discovery
// This file intentionally does nothing

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // No-op
});
