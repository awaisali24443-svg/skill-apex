
/**
 * @file Service Worker for Skill Apex PWA
 * @version 5.24.1 (Clean Boot)
 *
 * STRATEGY: Core First.
 * Only cache the absolute essentials to boot the app.
 * All feature modules (game, profile, etc.) are cached at runtime.
 */

const CACHE_NAME = 'skill-apex-core-v5.24.1';
const RUNTIME_CACHE = 'skill-apex-runtime-v5';

// ONLY files strictly required to show the "Home" screen and Sidebar.
const CORE_ASSETS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'global/global.css',
    'global/global.js',
    'manifest.json',
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    // Core Services
    'services/configService.js',
    'services/stateService.js',
    'services/sidebarService.js',
    'services/firebaseService.js',
    'services/toastService.js',
    'services/errorService.js',
    // Home Module
    'modules/home/home.html',
    'modules/home/home.css',
    'modules/home/home.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API: Network Only
    if (url.pathname.startsWith('/api')) return;

    // Google Fonts: Stale While Revalidate
    if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
        event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, event.request));
        return;
    }

    // Core Assets: Cache First
    if (CORE_ASSETS.some(asset => event.request.url.includes(asset))) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
        return;
    }

    // Default: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, event.request));
});

async function staleWhileRevalidate(cacheName, request) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => { /* Network failed, rely on cache */ });

    return cachedResponse || fetchPromise;
}
