import { SCORE, scoreUrl } from "./score.js?v=18";

const scope = new URL(self.registration.scope);
const url = path => new URL(path, scope).href;
const cachePrefix = "fortune-offline:" + scope.pathname + ":";
const release = "21";
const cacheName = cachePrefix + release;
const shell = url("./?v=" + release);
const complete = url(".offline-complete");
const files = [
  "./?v=" + release, "./game.js?v=21", "./offline.js?v=21", "./chart-view.js?v=21", "./chart.css?v=21", "./chart-paper.webp",
  "./pirates.css?v=21", "./touch.css?v=21", "./chapter.css?v=21", "./port.css?v=16", "./sea.css?v=19",
  "./world.js?v=20", "./render.js?v=21", "./trade.js?v=20", "./skills.js?v=17", "./captain-skills.js?v=17",
  "./story.js?v=17", "./menu-scene.js?v=13", "./sea.js?v=17", "./sea-render.js?v=19", "./sound.js?v=18", "./score.js?v=18",
  "./soundtrack.html", "./soundtrack.js?v=18", "./soundtrack.css?v=17", "./pirates.css?v=15",
  "./fortune.webmanifest", "./icon-32.png", "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./fort.webp", "./awakening.webp", "./island-arrival.webp", "./island-ending.webp", "./rogues-port.webp",
  "./portraits.webp", "./king-portrait.webp", "./death-skull.webp", "./runa.webp", "./brann.webp", "./shkiv.webp", "./rust-hook.webp",
  "./runa-shop.webp", "./brann-shop.webp", "./shkiv-shop.webp",
  "./portraits/pirate-tense.webp", "./portraits/watcher-tense.webp", "./portraits/king-tense.webp", "./portraits/rust-tense.webp",
  "./portraits/runa-tense.webp", "./portraits/runa-joy.webp", "./portraits/brann-tense.webp", "./portraits/shkiv-joy.webp",
  "./viewmodels.png?v=11", "./instruments.png", "./captain-icons.png", "./skill-icons.png", "./trade-icons.png",
  "./kelly-cyrillic.woff2", "./kelly-latin.woff2", "../manrope-cyrillic.woff2", "../manrope-latin.woff2",
].map(url).concat(SCORE.flatMap(group => group.tracks.map(([key]) => scoreUrl(key).href)));
const paths = new Set(files.map(file => new URL(file).pathname));
const clientsWaiting = new Set();
let download;

self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

async function currentFiles(cache) {
  const entries = new Set((await cache.keys()).map(request => request.url));
  const missing = files.filter(file => !entries.has(file));
  return { missing, ready: missing.length === 0 && entries.has(complete) };
}

async function downloadBundle() {
  const cache = await caches.open(cacheName);
  const { missing, ready } = await currentFiles(cache);
  if (ready) return;
  await cache.delete(complete);
  let next = 0;
  let done = files.length - missing.length;
  let failed = false;
  const progress = () => {
    for (const port of clientsWaiting) port.postMessage({ type: "progress", done, total: files.length });
  };
  progress();
  const slots = Array.from({ length: 4 }, async () => {
    while (!failed && next < missing.length) {
      const file = missing[next++];
      try {
        const response = await fetch(file, { cache: "reload", redirect: "error" });
        if (response.status !== 200) throw new Error("Failed to download " + file);
        if (file === shell && !(await response.clone().text()).includes("./game.js?v=" + release)) {
          throw new Error("Game page belongs to another release");
        }
        await cache.put(file, response);
        done++;
        progress();
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  const rejected = (await Promise.allSettled(slots)).find(result => result.status === "rejected");
  if (rejected) throw rejected.reason;
  await cache.put(complete, new Response("ready"));
  const outdated = (await caches.keys()).filter(name => name.startsWith(cachePrefix) && name !== cacheName);
  await Promise.allSettled(outdated.map(name => caches.delete(name)));
}

async function answer(port, command) {
  try {
    if (command === "status") {
      const cache = await caches.open(cacheName);
      const { ready } = await currentFiles(cache);
      port.postMessage({ type: "status", ready });
    } else {
      clientsWaiting.add(port);
      download ??= downloadBundle().finally(() => { download = undefined; });
      await download;
      port.postMessage({ type: "ready" });
    }
  } catch (error) {
    port.postMessage({ type: "error", storage: error?.name === "QuotaExceededError" });
  } finally {
    clientsWaiting.delete(port);
    port.close();
  }
}
self.addEventListener("message", event => {
  if (event.ports[0] && ["status", "download"].includes(event.data)) {
    event.waitUntil(answer(event.ports[0], event.data));
  }
});

async function savedResponse(request, target, gamePage) {
  const names = (await caches.keys()).filter(name => name.startsWith(cachePrefix)).reverse();
  for (const name of names) {
    const cache = await caches.open(name);
    if (!await cache.match(complete)) continue;
    const key = gamePage ? url("./?v=" + name.slice(cachePrefix.length)) : target;
    const stored = await cache.match(key);
    if (stored) return audioRange(stored, request.headers.get("Range"));
  }
  return Response.error();
}

async function audioRange(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? "");
  if (!response.headers.get("Content-Type")?.startsWith("audio/") || !match) return response;
  const [, left, right] = match;
  const body = await response.blob();
  const start = left ? Number(left) : Math.max(0, body.size - Number(right));
  const end = left && right ? Math.min(Number(right) + 1, body.size) : body.size;
  if (start >= end || end <= 0) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + body.size } });
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", "bytes " + start + "-" + (end - 1) + "/" + body.size);
  headers.set("Content-Length", String(end - start));
  return new Response(body.slice(start, end), { status: 206, headers });
}

async function networkWithOfflineFallback(request, target, gamePage) {
  let online;
  try {
    online = await fetch(request);
    if (online.ok) return online;
  } catch { /* Look up the downloaded files. */ }
  const saved = await savedResponse(request, target, gamePage);
  return saved.type === "error" && online ? online : saved;
}
self.addEventListener("fetch", event => {
  const request = event.request;
  const address = new URL(request.url);
  if (request.method !== "GET" || address.origin !== scope.origin) return;
  if (!address.pathname.startsWith(scope.pathname) && !paths.has(address.pathname)) return;
  if (request.mode === "navigate") address.search = "";
  const gamePage = address.pathname === scope.pathname || address.pathname === scope.pathname + "index.html";
  event.respondWith(networkWithOfflineFallback(request, address.href, gamePage));
});
