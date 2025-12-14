
/**
 * @file Service Worker for Skill Apex PWA
 * @version 5.26.0 (Full Feature Set)
 *
 * This Service Worker caches ALL application assets to ensure
 * complete offline functionality without compromising features.
 */

const CACHE_NAME = 'skill-apex-v5.26.0-full';
const RUNTIME_CACHE = 'skill-apex-runtime-v5';

// Complete Asset List
const APP_ASSETS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'manifest.json',
    
    // Global
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

    // Themes (All themes included)
    'themes/theme-dark.css',
    'themes/theme-dark-cyber.css',
    'themes/theme-dark-arcane.css',
    'themes/theme-dark-nebula.css',
    'themes/theme-light-cyber.css',
    'themes/theme-light-solar.css',

    // Icons
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    'assets/icons/achievements.svg',

    // Modules (HTML/CSS/JS for all features)
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
            console.log('[SW] Installing Full Asset Set');
            // We use Promise.allSettled to ensure that one missing file (e.g. a typo)
            // doesn't crash the entire installation, though best practice is all success.
            return cache.addAll(APP_ASSETS).catch(err => {
                console.warn('[SW] Some assets failed to cache, app will still load:', err);
            });
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
                        // Clear old caches including the bare-metal one
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] Pruning old cache:', cacheName);
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

    // 1. API Calls: Network Only
    if (url.pathname.startsWith('/api')) return;

    // 2. Google Fonts / External: StaleWhileRevalidate
    if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com') || url.origin.includes('esm.sh')) {
        event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, event.request));
        return;
    }

    // 3. App Assets: Cache First, Fallback to Network
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then(networkRes => {
                // Opportunistically cache new files
                return caches.open(RUNTIME_CACHE).then(cache => {
                    if (networkRes.ok) cache.put(event.request, networkRes.clone());
                    return networkRes;
                });
            });
        }).catch(() => {
            // Offline Fallback could go here
        })
    );
});

async function staleWhileRevalidate(cacheName, request) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(e => console.log('Fetch failed', e));

    return cachedResponse || fetchPromise;
}
