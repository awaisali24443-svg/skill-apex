// sw.js - Service Worker for PWA capabilities

const CACHE_NAME = 'knowledge-tester-v1.1.0'; // Version from package.json
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
    '/constants.js',
    '/manifest.json',
    '/icon.svg',

    // Modules
    '/modules/welcome/welcome.html',
    '/modules/welcome/welcome.css',
    '/modules/welcome/welcome.js',
    '/modules/home/home.html',
    '/modules/home/home.css',
    '/modules/home/home.js',
    '/modules/explore-topics/explore-topics.html',
    '/modules/explore-topics/explore-topics.css',
    '/modules/explore-topics/explore-topics.js',
    '/modules/topic-list/topic-list.html',
    '/modules/topic-list/topic-list.css',
    '/modules/topic-list/topic-list.js',
    '/modules/optional-quiz-generator/optional-quiz-generator.html',
    '/modules/optional-quiz-generator/optional-quiz-generator.css',
    '/modules/optional-quiz-generator/optional-quiz-generator.js',
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
    if (event.request.url.startsWith('https://fonts.gstatic.com')) {
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
                if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic' || event.request.method !== 'GET') {
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