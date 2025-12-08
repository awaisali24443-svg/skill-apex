
/**
 * @file Service Worker for Skill Apex PWA
 * @version 11.0.0-HOTFIX
 *
 * Forces a clean install of all assets to fix broken import maps.
 */

const CACHE_NAME = 'skill-apex-v11-hotfix';
// List of old cache names to aggressively delete
const OLD_CACHES = [
    'skill-apex-v10-fixed',
    'skill-apex-v9-fix',
    'skill-apex-v8-emergency',
    'skill-apex-v7-stable', 
    'skill-apex-v6.0.0-clean-reboot', 
    'skill-apex-v5.6.1', 
    'skill-apex-cache-v1'
];

const APP_SHELL_URLS = [
    '/',
    'index.html',
    'index.js?v=11.0',
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
    'modules/topic-list/topic-list.html', 'modules/topic-list/topic-list.css', 'modules/topic-list/topic-list.js'
];

self.addEventListener('install', (event) => {
    // Force immediate takeover
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching App Shell v11.0');
            return cache.addAll(APP_SHELL_URLS).catch(err => {
                console.error('[SW] Cache addAll failed:', err);
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    // Claim clients immediately
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Aggressively delete anything that isn't the current cache
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
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
    
    // Ignore non-GET requests or browser-extension requests
    if (request.method !== 'GET' || !request.url.startsWith('http')) return;

    // Stale-while-revalidate strategy
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return networkResponse;
            }).catch(err => {
                // If offline and no cache, throw
                if (!cachedResponse) throw err;
            });
            return cachedResponse || fetchPromise;
        })
    );
});
