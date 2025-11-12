const CACHE_NAME = 'knowledge-tester-v2.0.0';
// Add assets to this list
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/index.js',
    '/constants.js',
    '/manifest.json',
    '/global/global.css',
    '/global/global.js',
    '/themes/theme-dark-cyber.css',
    '/assets/icons/favicon.svg',
    '/assets/icons/feather-sprite.svg',
    '/assets/images/apple-touch-icon.png',
    '/assets/images/og-image.png',
    '/assets/sounds/correct.mp3',
    '/assets/sounds/incorrect.mp3',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
];

// Install: Cache the application shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(APP_SHELL_URLS);
        }).catch(err => console.error("Cache addAll failed: ", err))
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch: Serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // API request for topics: Stale-while-revalidate
    if (request.url.includes('/api/topics')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    // Return cached response immediately, then update cache in background
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Ignore other API requests (like quiz generation) and external resources
    if (request.url.includes('/api/') || !request.url.startsWith(self.location.origin)) {
        return;
    }

    // For all other requests: Cache-first
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response; // Serve from cache
            }
            // If not in cache, fetch from network and cache it
            return fetch(request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
                return networkResponse;
            });
        }).catch(error => {
            console.error('Service Worker fetch error:', error);
            // You could return a fallback offline page here if you have one
        })
    );
});
