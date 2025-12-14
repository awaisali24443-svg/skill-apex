
/**
 * @file Service Worker for Skill Apex PWA
 * @version 5.20.0 (API Robustness & Dynamic Caching)
 *
 * This service worker implements a robust offline-first caching strategy.
 */

const CACHE_NAME = 'skill-apex-v5.20.0-robust';
const FONT_CACHE_NAME = 'google-fonts-cache-v1';

const APP_SHELL_URLS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'manifest.json',
    'data/topics.json',
    'data/prebaked_levels.json',
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
    'assets/icons/achievements.svg',
    'assets/images/apple-touch-icon.png',
    'assets/images/og-image.png',
    'assets/images/icon-192.png',
    'assets/images/icon-512.png',
    'assets/images/avatar-placeholder.png',
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
    'services/voiceCommandService.js',
    'services/firebaseService.js',
    'services/vfxService.js',
    'services/backgroundService.js',
    // App Modules
    'modules/auth/auth.html', 'modules/auth/auth.css', 'modules/auth/auth.js',
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
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== FONT_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Google Fonts - Stale While Revalidate
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(FONT_CACHE_NAME, event.request));
        return;
    }

    // 2. App Shell & Assets - Stale While Revalidate
    if (APP_SHELL_URLS.some(u => event.request.url.includes(u))) {
        event.respondWith(staleWhileRevalidate(CACHE_NAME, event.request));
        return;
    }

    // 3. API Calls (Never Cache)
    if (url.pathname.startsWith('/api')) {
        return;
    }

    // 4. Default: Network First -> Cache -> Fallback
    // This handles external scripts (esm.sh) and dynamic files not in shell
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    // Opaque responses (like some no-cors CDNs) can't be verified, 
                    // but we cache them if we are sure (risky). 
                    // For now, only cache Basic and CORS responses.
                    if (response.type !== 'basic' && response.type !== 'cors') return response;
                }

                // Dynamically cache successful GET requests (e.g. esm.sh imports)
                if (event.request.method === 'GET') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }

                return response;
            })
            .catch(() => {
                // Offline fallback
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    
                    // If asking for a page, return index.html (SPA Fallback)
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return caches.match('index.html');
                    }
                });
            })
    );
});
