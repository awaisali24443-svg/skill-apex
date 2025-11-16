// A version number is injected into the cache name.
// Bump this version when you want to force an update of the service worker
// and clear the old caches. This is essential after deploying new assets.
const CACHE_NAME = 'knowledge-tester-v3.1.6';
const FONT_CACHE_NAME = 'google-fonts-cache-v1';

// The list of assets to cache during installation.
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
    'themes/theme-dark.css',
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    'assets/images/apple-touch-icon.png',
    'assets/images/og-image.png',
    'assets/images/icon-192.png',
    'assets/images/icon-512.png',
    'assets/images/avatar-placeholder.png',
    'assets/images/circuit-bg.svg',
    'assets/sounds/correct.mp3',
    'assets/sounds/incorrect.mp3',
    'assets/sounds/click.mp3',
    'assets/sounds/start.mp3',
    'assets/sounds/finish.mp3',
    'assets/sounds/hover.mp3',
    'assets/sounds/achievement.mp3',
    'assets/sounds/flip.mp3',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
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
    // Current Modules
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

/**
 * Implements a Stale-While-Revalidate caching strategy.
 * This strategy serves content from the cache immediately for speed,
 * then fetches an updated version from the network in the background
 * to be used for the next visit.
 * @param {string} cacheName - The name of the cache to use.
 * @param {Request} request - The request to handle.
 * @returns {Promise<Response>}
 */
const staleWhileRevalidate = async (cacheName, request) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetch(request).then((networkResponse) => {
        // Don't cache opaque responses (e.g., from no-cors requests) or errors
        if (networkResponse.ok) {
           cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(err => {
        // If fetch fails (e.g., user is offline) and we have a cached response, return it.
        if (cachedResponse) {
            return cachedResponse;
        }
        // Re-throw if there's no cached version available.
        throw err;
    });
    return cachedResponse || fetchPromise;
};

// Install: Cache the application shell and take control immediately.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(APP_SHELL_URLS);
        }).then(() => {
            return self.skipWaiting();
        }).catch(err => console.error("Cache addAll or skipWaiting failed: ", err))
    );
});

// Activate: Clean up old caches and claim clients.
self.addEventListener('activate', (event) => {
    const allowedCaches = [CACHE_NAME, FONT_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!allowedCaches.includes(cacheName)) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch: Intercept network requests and apply caching strategies.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Strategy 1: Stale-While-Revalidate for Google Fonts.
    // Serve from cache for speed, update in background.
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(FONT_CACHE_NAME, request));
        return;
    }

    // Strategy 2: Handle API requests.
    if (url.pathname.startsWith('/api/')) {
        // For GET /api/topics, use Stale-While-Revalidate for fast, offline-first data.
        if (request.method === 'GET' && url.pathname === '/api/topics') {
            event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
            return;
        }
        // For POST requests, go network-first. If offline, return a structured error.
        // This allows the frontend to gracefully handle offline mutations.
        if (request.method === 'POST') {
            event.respondWith(
                fetch(request).catch(() => {
                    return new Response(
                        JSON.stringify({ error: 'You are offline. This action requires an internet connection.' }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
            );
            return;
        }
        // Other API GET requests will pass through to the network by default.
        return;
    }
    
    // Strategy 3: Handle App Shell, Navigation, and Local Assets.
    if (url.origin === self.location.origin) {
        // For navigation requests (e.g., loading the page), use a "Network falling back to Cache" strategy.
        // This ensures the user gets the latest version of the app shell if online, but the app still
        // loads from cache if they are offline, making it a reliable PWA.
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(() => {
                    // Fallback to the cached index.html for any failed navigation.
                    return caches.match('/index.html', { cacheName: CACHE_NAME });
                })
            );
            return;
        }

        // For all other local assets (JS, CSS, images), use Stale-While-Revalidate.
        // This provides the best performance by serving assets from cache immediately.
        event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
        return;
    }
    
    // For any other cross-origin requests, let the browser handle them.
    // The default behavior is to fetch from the network without caching here.
});
