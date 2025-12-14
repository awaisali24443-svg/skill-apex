
/**
 * @file Service Worker for Skill Apex PWA
 * @version 5.20.0 (Clean Build)
 */

const CACHE_NAME = 'skill-apex-v5.20.0-clean';
const RUNTIME_CACHE = 'skill-apex-runtime-v5';

const APP_ASSETS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'manifest.json',
    'data/topics.json',
    'global/global.css',
    'global/global.js',
    // Services
    'services/apiService.js',
    'services/backgroundService.js',
    'services/configService.js',
    'services/errorService.js',
    'services/firebaseService.js',
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
    'services/vfxService.js',
    'services/voiceCommandService.js',
    // Themes
    'themes/theme-dark.css',
    'themes/theme-dark-cyber.css',
    'themes/theme-dark-arcane.css',
    'themes/theme-dark-nebula.css',
    'themes/theme-light-cyber.css',
    'themes/theme-light-solar.css',
    // Assets
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    'assets/icons/achievements.svg',
    'assets/images/avatar-placeholder.png',
    // Modules
    'modules/auth/auth.html', 'modules/auth/auth.css', 'modules/auth/auth.js',
    'modules/home/home.html', 'modules/home/home.css', 'modules/home/home.js',
    'modules/topic-list/topic-list.html', 'modules/topic-list/topic-list.css', 'modules/topic-list/topic-list.js',
    'modules/game-map/game-map.html', 'modules/game-map/game-map.css', 'modules/game-map/game-map.js',
    'modules/game-level/game-level.html', 'modules/game-level/game-level.css', 'modules/game-level/game-level.js',
    'modules/library/library.html', 'modules/library/library.css', 'modules/library/library.js',
    'modules/history/history.html', 'modules/history/history.css', 'modules/history/history.js',
    'modules/leaderboard/leaderboard.html', 'modules/leaderboard/leaderboard.css', 'modules/leaderboard/leaderboard.js',
    'modules/profile/profile.html', 'modules/profile/profile.css', 'modules/profile/profile.js',
    'modules/aural/aural.html', 'modules/aural/aural.css', 'modules/aural/aural.js',
    'modules/quiz-review/quiz-review.html', 'modules/quiz-review/quiz-review.css', 'modules/quiz-review/quiz-review.js',
    'modules/settings/settings.html', 'modules/settings/settings.css', 'modules/settings/settings.js',
    'modules/study/study.html', 'modules/study/study.css', 'modules/study/study.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Best effort cache
            return cache.addAll(APP_ASSETS).catch(err => console.warn('Partial SW Cache:', err));
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
    if (url.pathname.startsWith('/api')) return; 

    // Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, networkResponse.clone()));
                }
                return networkResponse;
            }).catch(e => console.log('Offline fetch failed'));
            return cachedResponse || fetchPromise;
        })
    );
});
