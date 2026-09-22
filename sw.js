// Beast Hunter サービスワーカー
// 版を上げたら CACHE の名前も変える（古い保存分は自動で消える）
const CACHE = 'bh-0.11.1';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'];

self.addEventListener('install', e => {
  // 本体は必ず保存。アイコンは取れた分だけ保存（入れ忘れがあっても起動はできるように）
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(['./', './index.html', './manifest.webmanifest']);
    await Promise.all(CORE.filter(u => u.endsWith('.png')).map(u => c.add(u).catch(() => {})));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('bh-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 画面から「更新する」を押されたら、すぐ新しい版に切り替える
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // 通信（Firebaseなど）は触らない
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    // ゲーム本体：通信できれば最新を取り、できなければ保存分で起動
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE); c.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  // アイコンなど：保存分を優先
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
    return res;
  })));
});
