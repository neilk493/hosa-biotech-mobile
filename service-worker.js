const CACHE_NAME = "hosa-biotech-iphone-offline-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./question_loader.js",
  "./question_bank_compiled.js",
  "./platform_config.json",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const APP_SHELL_PATHS = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/question_loader.js",
  "/question_bank_compiled.js",
  "/platform_config.json",
  "/manifest.webmanifest"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.endsWith("/service-worker.js") || requestUrl.pathname === "/service-worker.js") return;

  const normalizedPath = requestUrl.pathname.replace(/\/{2,}/g, "/");
  const isNavigation = request.mode === "navigate";
  const isAppShellAsset = APP_SHELL_PATHS.has(normalizedPath) || APP_SHELL_PATHS.has(requestUrl.pathname) || requestUrl.pathname.endsWith("/index.html");

  if (isNavigation || isAppShellAsset) {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        return caches.match("./index.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
