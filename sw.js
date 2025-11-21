/**
 * @file Service Worker for Knowledge Tester PWA
 * @version 3.4.0
 *
 * This service worker implements a robust offline-first caching strategy.
 * Key features:
 * - App Shell Caching: Core assets are cached on install for instant loading.
 * - Stale-While-Revalidate: For non-critical assets (like fonts, local assets),
 *   the app serves from cache first for speed, then updates in the background.
 * - Network Falling Back to Cache: For navigation, it tries the network first
 *   to get the latest version, but falls back to the cached app shell if offline.
 * - API Caching: Caches static API data (`/api/topics`) and provides a graceful
 *   offline error response for mutating requests (POST).
 * - Automatic Cache Cleaning: Old caches are removed on activation to save space.
 */

// A version number is injected into the cache name.
// IMPORTANT: Bump this version when deploying new assets to force an update
// of the service worker and clear old caches. This should match the app version.
const CACHE_NAME = 'knowledge-tester-v3.4.0';
const FONT_CACHE_NAME = 'google-fonts-cache-v1';

// The list of assets that make up the "app shell" - the minimal resources
// needed for the app to run. These are cached during installation.
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
    'assets/images/circuit-bg.svg',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
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

/**
 * Implements a Stale-While-Revalidate caching strategy.
 * This strategy serves content from the cache immediately for speed,
 * then fetches an updated version from the network in the background
 * to be used for the next visit. Ideal for assets that are not critical
 * for the initial render but should be kept up-to-date.
 * @param {string} cacheName - The name of the cache to use.
 * @param {Request} request - The request to handle.
 * @returns {Promise<Response>}
 */
const staleWhileRevalidate = async (cacheName, request) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetch(request).then((networkResponse) => {
        // Don't cache opaque responses (e.g., from no-cors requests) or server errors.
        if (networkResponse.ok) {
           cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(err => {
        // If the network fetch fails (e.g., user is offline) and we have a cached
        // response, return it. This makes the strategy robust to network failures.
        if (cachedResponse) {
            return cachedResponse;
        }
        // If there's no cached version, the error must be propagated.
        throw err;
    });
    return cachedResponse || fetchPromise;
};

// 'install' event: Caches the application shell and takes control immediately.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            // addAll is atomic: if one asset fails, the entire cache operation fails.
            // This ensures the app shell is always complete.
            return cache.addAll(APP_SHELL_URLS);
        }).then(() => {
            // Force the waiting service worker to become the active service worker.
            return self.skipWaiting();
        }).catch(err => console.error("Service Worker install failed: ", err))
    );
});

// 'activate' event: Cleans up old caches and claims clients.
self.addEventListener('activate', (event) => {
    // List of caches that should be kept.
    const allowedCaches = [CACHE_NAME, FONT_CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If a cache is not in our allowed list, delete it.
                    if (!allowedCaches.includes(cacheName)) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all open clients without waiting for a reload.
            return self.clients.claim();
        })
    );
});

// 'fetch' event: Intercepts network requests and applies caching strategies.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // --- Caching Strategy Router ---

    // Strategy 1: Stale-While-Revalidate for Google Fonts.
    // Serves fonts from cache for fast rendering, then updates in the background.
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(FONT_CACHE_NAME, request));
        return;
    }

    // Strategy 2: API Request Handling.
    if (url.pathname.startsWith('/api/')) {
        // For GET /api/topics, use Stale-While-Revalidate. This static data is ideal for
        // caching to make the app feel faster and work offline.
        if (request.method === 'GET' && url.pathname === '/api/topics') {
            event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
            return;
        }
        
        // For POST requests, always go to the network. These are mutating operations
        // and must not be served from a cache. If offline, return a structured error.
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
        
        // Let other API GET requests pass through to the network without caching.
        // This is the default safe behavior for potentially dynamic API data.
        return;
    }
    
    // Strategy 3: App Shell, Navigation, and Local Assets (same origin).
    if (url.origin === self.location.origin) {
        
        // For navigation requests, use "Network falling back to Cache".
        // This ensures users get the latest version if online, but the app
        // still loads from cache if offline, making it a reliable PWA.
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(() => {
                    // If network fails, serve the main entry point from the cache.
                    // This makes the app load even when offline.
                    return caches.match('/', { cacheName: CACHE_NAME });
                })
            );
            return;
        }

        // For all other local assets (JS, CSS, images), use Stale-While-Revalidate.
        // This provides the best performance by serving from cache immediately,
        // making subsequent interactions feel instant.
        event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
        return;
    }
    
    // For any other cross-origin requests, let the browser handle them by default.
});