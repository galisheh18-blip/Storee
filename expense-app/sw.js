/* Service Worker — «Мои траты».
   Стратегия «сначала сеть»: при наличии интернета всегда берём свежие файлы
   и обновляем кэш; кэш используется только как запасной вариант офлайн.
   Так обновления приложения подхватываются сразу, без застревания на старой версии. */
const CACHE = "expense-app-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // обновляем кэш свежей копией
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        // нет сети — отдаём из кэша, для навигации — index.html
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
