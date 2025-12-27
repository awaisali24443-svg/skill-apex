/**
 * @file Service Worker for Skill Apex PWA
 * @version 16.0.0 (Cloud Connected & Immersive Visuals)
 */

const CACHE_NAME = 'skill-apex-v16.0.0-final';
const FONT_CACHE_NAME = 'google-fonts-v2';

const ESSENTIAL_ASSETS = [
    '/',
    '/index.html',
    '/index.js',
    '/constants.js',
    '/manifest.json',
    '/global/global.css',
    '/global/global.js',
    '/themes/theme-light-cyber.css',
    '/themes/theme-dark-cyber.css',
    '/assets/icons/feather-sprite.svg',
    '/assets/icons/favicon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ESSENTIAL_ASSETS)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((k) => {
                if (k !== CACHE_NAME && k !== FONT_CACHE_NAME) return caches.delete(k);
            })
        ))
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api') || url.host.includes('firebase')) return;

    event.respondWith(
        caches.match(event.request).then((res) => {
            return res || fetch(event.request).then((networkRes) => {
                if (networkRes.ok && ESSENTIAL_ASSETS.includes(url.pathname)) {
                    const cacheCopy = networkRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
                }
                return networkRes;
            });
        })
    );
});
