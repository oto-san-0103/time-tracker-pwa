const CACHE_NAME = 'time-tracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    // Chart.jsなどの外部ライブラリもキャッシュ対象に含める
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// Service Workerのインストール（キャッシュの保存）
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// リクエスト時の動作（キャッシュから提供）
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュに見つかったらそれを返す
                if (response) {
                    return response;
                }
                // 見つからなかったらネットワークから取得
                return fetch(event.request);
            })
    );
});