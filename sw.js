/* 청진노트 오프라인 캐시
 * 앱 파일은 "네트워크 먼저": GitHub에 올린 수정본이 바로 반영되고, 인터넷이 없으면 저장해 둔 파일로 열립니다.
 * 글꼴은 "캐시 먼저": 한 번 받은 글꼴은 오프라인에서도 쓰입니다.
 * 앱 파일 목록을 바꾸면 아래 CACHE 이름의 숫자를 올려 주세요.
 */
const CACHE = 'cheongjin-v1';
const SHELL = ['./', './index.html', './subjects/health-assessment.js', './manifest.json', './icon-192.png', './icon-512.png'];

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
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
