/* 청진노트 오프라인 캐시
 * 앱 파일은 "네트워크 먼저": GitHub에 올린 수정본이 바로 반영되고, 인터넷이 없으면 저장해 둔 파일로 열립니다.
 * 과목 파일은 처음 열 때 저장돼요. 그래서 과목을 추가해도 이 파일은 고칠 필요가 없어요.
 * 글꼴과 PDF 도구는 "캐시 먼저": 한 번 받으면 오프라인에서도 쓰입니다.
 */
const CACHE = 'cheongjin-v4';
const SHELL = ['./', './index.html', './app.js', './subjects/list.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
