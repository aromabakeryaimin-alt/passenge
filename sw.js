// 瑞里智能購票系統 - 離線快取用 Service Worker
// 部署方式：把這個檔案跟 index.html 放在「同一個資料夾」，並用 https 網址開啟（PWA 安裝與離線快取都需要 https，
// 用 file:// 直接雙擊開啟 html 檔案是無法安裝或離線使用的）。
//
// 這是一個「app shell」快取策略的最簡單版本：
// - 把應用程式本身的 HTML 快取起來，離線時仍可打開已購買車票、銀包餘額等畫面（真正的資料仍需要網絡才能更新）。
// - 完全不快取 Firebase 的 API 請求，避免離線時看到過期或錯誤的餘額/車票資料。

const CACHE_NAME = 'ruili-ticketing-shell-v1';
const APP_SHELL = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // 找不到檔案時安靜失敗，不影響其他功能
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Firebase 即時資料一律直接連線，絕不快取，避免離線時顯示過期的銀包餘額或車票狀態
  if (url.includes('firebaseio.com') || url.includes('googleapis.com')) {
    return;
  }

  // 只快取本站的 GET 請求（app shell），其餘一律直接走網路
  if (event.request.method !== 'GET' || !url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached); // 離線時退回快取版本
      return cached || network;
    })
  );
});
