
/**
 * @file Service Worker for Knowledge Tester PWA
 * @version 3.8.7
 *
 * This service worker implements a robust offline-first caching strategy.
 */

const CACHE_NAME = 'knowledge-tester-v3.8.7';
const FONT_CACHE_NAME = 'google-fonts-cache-v1';

const APP_SHELL_URLS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'manifest.json',
    'data/topics.json',
    'global/global.css',
    'global/global.js',
    'themes/theme-dark-cyber.css',
    'themes/theme-light-cyber.css',
    'themes/theme-light-solar.css',
    'themes/theme-dark.css',
    'themes/theme-dark-arcane.css',
    'themes/theme-dark-nebula.css',
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    'assets/images/apple-touch-icon.png',
    'assets/images/og-image.png',
    'assets/images/icon-192.png',
    'assets/images/icon-512.png',
    'assets/images/avatar-placeholder.png',
    // 'assets/images/circuit-bg.svg', // Removed: Inlined in global.css for performance
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
    'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
    // Core Services
    'services/apiService.js',
    'services/configService.js',
    'services/errorService.js',
    'services/gamificationService.js',
    'services/historyService.js',
    'services/learningPathService.js',
    'services/levelCacheService.js',
    'services/libraryService.js',
    'services/markdownService.js',
    'services/modalService.js',
    'services/sidebarService.js',
    'services/soundService.js',
    'services/stateService.js',
    'services/themeService.js',
    'services/toastService.js',
    // App Modules
    'modules/home/home.html', 'modules/home/home.css', 'modules/home/home.js',
    'modules/topic-list/topic-list.html', 'modules/topic-list/topic-list.css', 'modules/topic-list/topic-list.js',
    'modules/library/library.html', 'modules/library/library.css', 'modules/library/library.js',
    'modules/history/history.html', 'modules/history/history.css', 'modules/history/history.js',
    'modules/study/study.html', 'modules/study/study.css', 'modules/study/study.js',
    'modules/aural/aural.html', 'modules/aural/aural.css', 'modules/aural/aural.js',
    'modules/settings/settings.html', 'modules/settings/settings.css', 'modules/settings/settings.js',
    'modules/game-map/game-map.html', 'modules/game-map/game-map.css', 'modules/game-map/game-map.js',
    'modules/game-level/game-level.html', 'modules/game-level/game-level.css', 'modules/game-level/game-level.js',
    'modules/profile/profile.html', 'modules/profile/profile.css', 'modules/profile/profile.js',
    'modules/quiz-review/quiz-review.html', 'modules/quiz-review/quiz-review.css', 'modules/quiz-review/quiz-review.js',
];

const staleWhileRevalidate = async (cacheName, request) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
           cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(err => {
        if (cachedResponse) return cachedResponse;
        throw err;
    });
    return cachedResponse || fetchPromise;
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL_URLS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    const allowedCaches = [CACHE_NAME, FONT_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!allowedCaches.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(FONT_CACHE_NAME, request));
        return;
    }

    // Handle CDN libs (mermaid, dompurify, express shims)
    // CRITICAL: We must cache aistudiocdn.com for the importmap to work offline
    if (url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://aistudiocdn.com') {
        event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
        return;
    }

    if (url.pathname.startsWith('/api/')) {
        if (request.method === 'GET' && url.pathname === '/api/topics') {
            event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
            return;
        }
        if (request.method === 'POST') {
            event.respondWith(
                fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), { status: 503 }))
            );
            return;
        }
        return;
    }
    
    if (url.origin === self.location.origin) {
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(() => caches.match('/', { cacheName: CACHE_NAME }))
            );
            return;
        }
        event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
        return;
    }
});
