// A version number is injected into the cache name.
// Bump this version when you want to force an update of the service worker
// and clear the old caches. This is essential after deploying new assets.
const CACHE_NAME = 'knowledge-tester-v2.8.7';
const FONT_CACHE_NAME = 'google-fonts-cache-v1';

// The list of assets to cache during installation.
const APP_SHELL_URLS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'manifest.json',
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
    'assets/sounds/correct.mp3',
    'assets/sounds/incorrect.mp3',
    'assets/sounds/click.mp3',
    'assets/sounds/start.mp3',
    'assets/sounds/finish.mp3',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
    'services/apiService.js',
    'services/configService.js',
    'services/errorService.js',
    'services/feedbackService.js',
    'services/gamificationService.js',
    'services/historyService.js',
    'services/learningPathService.js',
    'services/levelCacheService.js',
    'services/libraryService.js',
    'services/markdownService.js',
    'services/modalService.js',
    'services/quizStateService.js',
    'services/searchService.js',
    'services/sidebarService.js',
    'services/soundService.js',
    'services/themeService.js',
    'services/toastService.js',
    'modules/home/home.html', 'modules/home/home.css', 'modules/home/home.js',
    'modules/topic-list/topic-list.html', 'modules/topic-list/topic-list.css', 'modules/topic-list/topic-list.js',
    'modules/library/library.html', 'modules/library/library.css', 'modules/library/library.js',
    'modules/history/history.html', 'modules/history/history.css', 'modules/history/history.js',
    'modules/study/study.html', 'modules/study/study.css', 'modules/study/study.js',
    'modules/aural/aural.html', 'modules/aural/aural.css', 'modules/aural/aural.js',
    'modules/settings/settings.html', 'modules/settings/settings.css', 'modules/settings/settings.js',
    'modules/profile/profile.html', 'modules/profile/profile.css', 'modules/profile/profile.js',
    'modules/game-map/game-map.html', 'modules/game-map/game-map.css', 'modules/game-map/game-map.js',
    'modules/game-level/game-level.html', 'modules/game-level/game-level.css', 'modules/game-level/game-level.js',
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

// Fetch: Apply caching strategies based on the request type.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Google Fonts: Use Stale-While-Revalidate for both the CSS and font files.
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(FONT_CACHE_NAME, request));
        return;
    }

    // 2. API Requests: Handle differently based on the method.
    if (url.pathname.startsWith('/api/')) {
        // Use Stale-While-Revalidate for the GET request to fetch topics.
        if (request.method === 'GET' && url.pathname === '/api/topics') {
            event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
            return;
        }
        // For POST requests (like generating a quiz), try the network first.
        // If offline, return a custom JSON error response.
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
    }
    
    // 3. App Shell, Navigation, and Local Assets
    if (url.origin === self.location.origin) {
        // For navigation requests (loading a page), use a "Network falling back to Cache"
        // strategy. This is crucial for a Single Page App (SPA) to work offline.
        // It ensures the user gets the latest version if online, but the app still
        // loads from the cached HTML shell if they are offline.
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request).catch(() => {
                    // The catch is triggered when the network request fails,
                    // which is a good indicator that the user is offline.
                    return caches.match('/index.html', { cacheName: CACHE_NAME });
                })
            );
            return;
        }

        // For all other local assets (JS, CSS, images, etc.), use the
        // Stale-While-Revalidate strategy for optimal performance and freshness.
        event.respondWith(staleWhileRevalidate(CACHE_NAME, request));
        return;
    }
    
    // For any other requests (e.g., CDN scripts from importmap), let the browser handle them.
    // The default behavior is to fetch from the network.
});