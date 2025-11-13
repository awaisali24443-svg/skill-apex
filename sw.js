const CACHE_NAME = 'knowledge-tester-v2.0.3';
// Add assets to this list
const APP_SHELL_URLS = [
    '/',
    '/index.html',
    '/index.js',
    '/constants.js',
    '/manifest.json',
    '/global/global.css',
    '/global/global.js',
    '/themes/theme-dark-cyber.css',
    '/themes/theme-light-cyber.css',
    '/themes/theme-dark.css',
    '/assets/icons/favicon.svg',
    '/assets/icons/feather-sprite.svg',
    '/assets/images/apple-touch-icon.png',
    '/assets/images/og-image.png',
    '/assets/sounds/correct.mp3',
    '/assets/sounds/incorrect.mp3',
    '/assets/sounds/click.mp3',
    '/assets/sounds/start.mp3',
    '/assets/sounds/finish.mp3',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Inter:wght@400;600&family=Roboto+Mono:wght@400;500&display=swap',
    '/services/apiService.js',
    '/services/backgroundService.js',
    '/services/configService.js',
    '/services/errorService.js',
    '/services/historyService.js',
    '/services/learningPathService.js',
    '/services/libraryService.js',
    '/services/modalService.js',
    '/services/quizStateService.js',
    '/services/searchService.js',
    '/services/sidebarService.js',
    '/services/soundService.js',
    '/services/themeService.js',
    '/services/toastService.js',
    '/modules/home/home.html', '/modules/home/home.css', '/modules/home/home.js',
    '/modules/topic-list/topic-list.html', '/modules/topic-list/topic-list.css', '/modules/topic-list/topic-list.js',
    '/modules/explore-topics/explore-topics.html', '/modules/explore-topics/explore-topics.css', '/modules/explore-topics/explore-topics.js',
    '/modules/optional-quiz-generator/optional-quiz-generator.html', '/modules/optional-quiz-generator/optional-quiz-generator.css', '/modules/optional-quiz-generator/optional-quiz-generator.js',
    '/modules/loading/loading.html', '/modules/loading/loading.css', '/modules/loading/loading.js',
    '/modules/quiz/quiz.html', '/modules/quiz/quiz.css', '/modules/quiz/quiz.js',
    '/modules/results/results.html', '/modules/results/results.css', '/modules/results/results.js',
    '/modules/library/library.html', '/modules/library/library.css', '/modules/library/library.js',
    '/modules/history/history.html', '/modules/history/history.css', '/modules/history/history.js',
    '/modules/study/study.html', '/modules/study/study.css', '/modules/study/study.js',
    '/modules/aural/aural.html', '/modules/aural/aural.css', '/modules/aural/aural.js',
    '/modules/learning-path-generator/learning-path-generator.html', '/modules/learning-path-generator/learning-path-generator.css', '/modules/learning-path-generator/learning-path-generator.js',
    '/modules/learning-path/learning-path.html', '/modules/learning-path/learning-path.css', '/modules/learning-path/learning-path.js',
    '/modules/settings/settings.html', '/modules/settings/settings.css', '/modules/settings/settings.js',
];

// Install: Cache the application shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching app shell');
            return cache.addAll(APP_SHELL_URLS);
        }).catch(err => console.error("Cache addAll failed: ", err))
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch: Serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // API request for topics: Stale-while-revalidate
    if (request.url.includes('/api/topics')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                    // Return cached response immediately, then update cache in background
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Ignore other API requests (like quiz generation) and external resources
    if (request.url.includes('/api/') || !request.url.startsWith(self.location.origin)) {
        return;
    }

    // For all other requests: Cache-first
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response; // Serve from cache
            }
            // If not in cache, fetch from network and cache it
            return fetch(request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
                return networkResponse;
            });
        }).catch(error => {
            console.error('Service Worker fetch error:', error);
            // You could return a fallback offline page here if you have one
        })
    );
});