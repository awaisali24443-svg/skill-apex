// sw.js - Service Worker for PWA capabilities

const CACHE_NAME = 'knowledge-tester-v2.6.0'; // Version bump for new features and cleanup
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/global/global.css',
    '/global/accessibility.css',
    '/themes/theme-dark-cyber.css',
    '/global/global.js',
    '/global/header.html',
    '/services/geminiService.js',
    '/services/progressService.js',
    '/services/quizStateService.js',
    '/services/soundService.js',
    '/services/topicService.js',
    '/services/navigationService.js',
    '/services/threeManager.js',
    '/services/stellarMap.js',
    '/services/achievementService.js',
    '/services/missionService.js',
    '/services/leaderboardService.js',
    '/services/authService.js',
    '/firebase-config.js',
    '/constants.js',
    '/manifest.json',
    '/icon.svg',

    // Core Modules
    '/modules/home/home.html',
    '/modules/home/home.css',
    '/modules/home/home.js',
    '/modules/challenge-setup/challenge-setup.html',
    '/modules/challenge-setup/challenge-setup.css',
    '/modules/challenge-setup/challenge-setup.js',
    '/modules/loading/loading.html',
    '/modules/loading/loading.css',
    '/modules/loading/loading.js',
    '/modules/quiz/quiz.html',
    '/modules/quiz/quiz.css',
    '/modules/quiz/quiz.js',
    '/modules/results/results.html',
    '/modules/results/results.css',
    '/modules/results/results.js',
    '/modules/screen/screen.html',
    '/modules/screen/screen.css',
    '/modules/screen/screen.js',
    '/modules/settings/settings.html',
    '/modules/settings/settings.css',
    '/modules/settings/settings.js',
    '/modules/login/login.html',
    '/modules/login/login.css',
    '/modules/login/login.js',
    '/modules/signup/signup.html',
    '/modules/signup/signup.css',
    '/modules/signup/signup.js',
    '/modules/study/study.html',
    '/modules/study/study.css',
    '/modules/study/study.js',
    '/modules/leaderboard/leaderboard.html',
    '/modules/leaderboard/leaderboard.css',
    '/modules/leaderboard/leaderboard.js',

    // Fonts CSS
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;700;800&family=Orbitron:wght@700;800&display=swap'
];

// Install event: open cache and add all core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache and caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event: serve from cache, fall back to network, and cache new requests
self.addEventListener('fetch', (event) => {
    // For external resources like Google Fonts, use a stale-while-revalidate strategy.
    if (event.request.url.startsWith('https://fonts.gstatic.com') || event.request.url.startsWith('https://www.gstatic.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // For app resources, use a cache-first strategy.
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response; // Serve from cache
            }
            // Not in cache, fetch from network
            return fetch(event.request).then((fetchResponse) => {
                // If the request is valid, cache it for future use
                if (!fetchResponse || fetchResponse.status !== 200 || event.request.method !== 'GET') {
                    return fetchResponse;
                }

                // Don't cache config script
                if (event.request.url.includes('/config.js')) {
                    return fetchResponse;
                }

                const responseToCache = fetchResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return fetchResponse;
            });
        })
    );
});