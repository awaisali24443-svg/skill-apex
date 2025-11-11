// sw.js

const CACHE_NAME = 'knowledge-tester-v1.4';
const STATIC_ASSETS = [
    '/global/global.css',
    '/global/splash.css',
    '/themes/theme-dark-cyber.css',
    '/global/accessibility.css',
    '/index.js',
    '/constants.js',
    // Pre-cache core services and home module for fast initial load
    '/services/configService.js',
    '/services/featureService.js',
    '/modules/home/home.js',
    '/modules/home/home.html',
    '/modules/home/home.css',
    // Fonts and assets
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.gstatic.com/s/orbitron/v31/yMJRMIlzdpvBhQQL_Qq7dy0.woff2',
    'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/icon.svg'
];

// On install, pre-cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Pre-caching static assets.');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // FIX #24: Ensure the new service worker takes control immediately
    return self.clients.claim();
});

// On fetch, implement caching strategy
self.addEventListener('fetch', event => {
    const { request } = event;

    // FIX #7: Use a more intelligent, hybrid caching strategy.
    
    // Strategy 1: Network First for HTML and API calls.
    // Ensures the user always gets the latest app logic and data.
    if (request.mode === 'navigate' || request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // If the request is successful, cache a copy for offline fallback
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try to serve from cache
                    return caches.match(request);
                })
        );
        return;
    }

    // Strategy 2: Cache First for all other static assets (CSS, JS, Fonts, etc.).
    // This provides the fastest possible response time.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // If we have a cached response, return it.
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise, fetch from the network, cache it, and return the response.
            return fetch(request).then(networkResponse => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});