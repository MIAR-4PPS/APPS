// MIAR APPS — service worker mínimo para tornar o app instalável.
// Não cacheia API/Clerk/assets — só intercepta navegações pra dar fallback offline básico.
const CACHE = "miar-shell-v1";
const SHELL = ["/engaja/", "/engaja/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Nunca interceptar API, Clerk ou recursos fora da origem.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pra navegações (carregar a página), tenta rede; se falhar, usa o cache da shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/engaja/").then((r) => r || Response.error()),
      ),
    );
    return;
  }
});
