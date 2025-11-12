// sw.js

const CACHE_NAME = 'knowledge-tester-v2.3'; // Incremented cache version
const STATIC_ASSETS = [
    '/global/global.css',
    '/global/splash.css',
    '/themes/theme-dark-cyber.css',
    '/global/accessibility.css',
    '/index.js',
    '/constants.js',
    // Core services
    '/services/configService.js',
    '/services/soundService.js',
    '/services/libraryService.js',
    '/services/topicService.js',
    '/services/geminiService.js', // FIX: Corrected service name
    // NEW: 3D Galaxy Services
    '/services/threeManager.js',
    // Home module for GALAXY view
    '/modules/home/home.js',
    '/modules/home/home.html',
    '/modules/home/home.css',
    // Pre-cache other important modules
    '/modules/aural/aural.js',
    '/modules/aural/aural.html',
    '/modules/aural/aural.css',
    '/modules/learning-path-generator/learning-path-generator.js',
    '/modules/learning-path-generator/learning-path-generator.html',
    '/modules/learning-path-generator/learning-path-generator.css',
    '/modules/learning-path/learning-path.js',
    '/modules/learning-path/learning-path.html',
    '/modules/learning-path/learning-path.css',
    // Fonts
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.gstatic.com/s/orbitron/v31/yMJRMIlzdpvBhQQL_Qq7dy0.woff2',
    'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
    // Core assets
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/icon.svg',
    // Audio assets
    '/assets/sounds/ambient.mp3',
    '/assets/sounds/click.wav',
    '/assets/sounds/hover.wav',
    '/assets/sounds/transition.wav',
    // NEW: High-resolution textures for the galaxy
    '/assets/textures/realistic_skybox/px.jpg',
    '/assets/textures/realistic_skybox/nx.jpg',
    '/assets/textures/realistic_skybox/py.jpg',
    '/assets/textures/realistic_skybox/ny.jpg',
    '/assets/textures/realistic_skybox/pz.jpg',
    '/assets/textures/realistic_skybox/nz.jpg',
    '/assets/textures/lensflare0.png',
    '/assets/textures/lensflare3.png',
    '/assets/textures/particle_noise.png',
    '/assets/textures/planets/earth_day.jpg',
    '/assets/textures/planets/earth_night.jpg',
    '/assets/textures/planets/earth_bump.jpg',
    '/assets/textures/planets/earth_specular.png',
    '/assets/textures/planets/earth_clouds.png',
    '/assets/textures/planets/mars.jpg',
    '/assets/textures/planets/mars_bump.jpg',
    '/assets/textures/planets/jupiter.jpg',
    '/assets/textures/planets/neptune.jpg',
    '/assets/textures/planets/ice.jpg',
    '/assets/textures/planets/rocky.jpg',
    '/assets/textures/planets/rocky_bump.jpg',
    '/assets/textures/planets/asteroid.jpg',
    '/assets/textures/rings/realistic_rings.png',
    // ENHANCEMENT: Add new normal maps for more detail
    '/assets/textures/planets/earth_normal.jpg',
    '/assets/textures/planets/mars_normal.jpg',
];

// On install, pre-cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Pre-caching static assets.');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Ensure the new service worker takes control immediately
    return self.clients.claim();
});

// On fetch, implement caching strategy
self.addEventListener('fetch', event => {
    const { request } = event;

    // Use a more intelligent, hybrid caching strategy.
    
    // Strategy 1: Network First for HTML and API calls.
    // Ensures the user always gets the latest app logic and data.
    if (request.mode === 'navigate' || request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // If the request is successful, cache a copy for offline fallback
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If network fails, try to serve from cache
                    return caches.match(request);
                })
        );
        return;
    }

    // Strategy 2: Cache First for all other static assets (CSS, JS, Fonts, etc.).
    // This provides the fastest possible response time.
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            // If we have a cached response, return it.
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise, fetch from the network, cache it, and return the response.
            return fetch(request).then(networkResponse => {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseToCache);
                });
                return networkResponse;
            });
        })
    );
});