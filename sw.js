
/**
 * @file Service Worker for Skill Apex PWA
 * @version 40.0.0-FIX-FINAL
 *
 * Forces a clean install of all assets to apply critical updates.
 */

const CACHE_NAME = 'skill-apex-v40.0-FIX-FINAL';
const OLD_CACHES = [
    'skill-apex-v39.0-FIX-FINAL',
    'skill-apex-v38-FIX-RESOLVE'
];

const APP_SHELL_URLS = [
    '/',
    'index.html',
    'index.js?v=40.0',
    'constants.js',
    'manifest.json',
    'data/topics.json',
    'global/global.css',
    'global/global.js',
    'themes/theme-dark-cyber.css',
    'themes/theme-light-cyber.css',
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    'assets/icons/achievements.svg',
    'assets/images/avatar-placeholder.png',
    'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js',
    'https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js',
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
    // Modules
    'modules/auth/auth.html', 'modules/auth/auth.css', 'modules/auth/auth.js',
    'modules/home/home.html', 'modules/home/home.css', 'modules/home/home.js',
    'modules/topic-list/topic-list.html', 'modules/topic-list/topic-list.css', 'modules/topic-list/topic-list.js',
    'modules/aural/aural.html', 'modules/aural/aural.css', 'modules/aural/aural.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL_URLS).catch(err => console.error('[SW] Cache failed:', err));
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
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return networkResponse;
            }).catch(() => {});
            return cachedResponse || fetchPromise;
        })
    );
});