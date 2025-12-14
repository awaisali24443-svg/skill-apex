
/**
 * @file Service Worker for Skill Apex PWA
 * @version 5.23.0 (Minimal Core)
 *
 * STRATEGY CHANGE: "Core First".
 * Only cache the absolute essentials to boot the app.
 * All feature modules (game, profile, etc.) are cached at runtime (StaleWhileRevalidate).
 * This prevents the entire app from failing to load if one non-critical file is missing.
 */

const CACHE_NAME = 'skill-apex-core-v5.23.0';
const RUNTIME_CACHE = 'skill-apex-runtime-v5';

// ONLY files strictly required to show the "Home" screen and Sidebar.
const CORE_ASSETS = [
    '/',
    'index.html',
    'index.js',
    'constants.js',
    'global/global.css',
    'global/global.js',
    'manifest.json',
    'assets/icons/favicon.svg',
    'assets/icons/feather-sprite.svg',
    // Core Services required for init
    'services/configService.js',
    'services/stateService.js',
    'services/sidebarService.js',
    'services/firebaseService.js',
    'services/toastService.js',
    'services/errorService.js',
    // Home Module (Landing Page)
    'modules/home/home.html',
    'modules/home/home.css',
    'modules/home/home.js'
];

self.addEventListener('install', (event) => {
    // Force immediate activation
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching Core Assets');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    // Claim clients immediately so the user doesn't need to refresh twice
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Clear old caches from previous versions
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('[SW] Clearing old cache:', cacheName);
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

    // 1. API Calls: Network Only (Never cache API responses in SW, let app handle it)
    if (url.pathname.startsWith('/api')) {
        return;
    }

    // 2. Google Fonts: Stale While Revalidate
    if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
        event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, event.request));
        return;
    }

    // 3. Core Assets: Cache First, falling back to Network
    if (CORE_ASSETS.some(asset => event.request.url.includes(asset))) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
        return;
    }

    // 4. Everything else (Modules, Images, Sounds): Stale While Revalidate
    // This allows the app to load even if offline, provided the user has visited that section before.
    event.respondWith(staleWhileRevalidate(RUNTIME_CACHE, event.request));
});

// Helper: Stale While Revalidate Strategy
async function staleWhileRevalidate(cacheName, request) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            // Only cache valid responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((err) => {
            // Network failed
            // If we have a cached response, we already returned it (or will return undefined if not)
            // But if we are *awaiting* this promise (no cache), we need to handle it.
            console.warn('[SW] Network fetch failed:', request.url);
            // Fallback logic could go here (e.g., return offline.html)
        });

    // Return cached response immediately if available, otherwise wait for network
    return cachedResponse || fetchPromise;
}
