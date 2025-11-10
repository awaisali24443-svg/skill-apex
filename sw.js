// sw.js

const CACHE_NAME = 'knowledge-tester-v2.0'; // Major version bump for new strategy
const urlsToCache = [
  '/',
  '/index.html',
  // Globals
  '/global/global.css',
  '/global/global.js',
  '/global/accessibility.css',
  '/global/splash.css',
  '/global/header.html',
  // Themes
  '/themes/theme-dark-cyber.css',
  // Third-party libraries (from CDN, will be cached on first fetch)
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.164.1/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  // All Modules
  '/modules/home/home.html', '/modules/home/home.css', '/modules/home/home.js',
  '/modules/welcome/welcome.html', '/modules/welcome/welcome.css', '/modules/welcome/welcome.js',
  '/modules/login/login.html', '/modules/login/login.css', '/modules/login/login.js',
  '/modules/signup/signup.html', '/modules/signup/signup.css', '/modules/signup/signup.js',
  '/modules/explore-topics/explore-topics.html', '/modules/explore-topics/explore-topics.css', '/modules/explore-topics/explore-topics.js',
  '/modules/topic-list/topic-list.html', '/modules/topic-list/topic-list.css', '/modules/topic-list/topic-list.js',
  '/modules/optional-quiz-generator/optional-quiz-generator.html', '/modules/optional-quiz-generator/optional-quiz-generator.css', '/modules/optional-quiz-generator/optional-quiz-generator.js',
  '/modules/loading/loading.html', '/modules/loading/loading.css', '/modules/loading/loading.js',
  '/modules/quiz/quiz.html', '/modules/quiz/quiz.css', '/modules/quiz/quiz.js',
  '/modules/results/results.html', '/modules/results/results.css', '/modules/results/results.js',
  '/modules/study/study.html', '/modules/study/study.css', '/modules/study/study.js',
  '/modules/progress/progress.html', '/modules/progress/progress.css', '/modules/progress/progress.js',
  '/modules/settings/settings.html', '/modules/settings/settings.css', '/modules/settings/settings.js',
  '/modules/library/library.html', '/modules/library/library.css', '/modules/library/library.js',
  '/modules/leaderboard/leaderboard.html', '/modules/leaderboard/leaderboard.css', '/modules/leaderboard/leaderboard.js',
  '/modules/learning-path/learning-path.html', '/modules/learning-path/learning-path.css', '/modules/learning-path/learning-path.js',
  '/modules/challenge-setup/challenge-setup.html', '/modules/challenge-setup/challenge-setup.css', '/modules/challenge-setup/challenge-setup.js',
  '/modules/challenge-results/challenge-results.html', '/modules/challenge-results/challenge-results.css', '/modules/challenge-results/challenge-results.js',
  // Placeholder modules
  '/modules/challenge-lobby/challenge-lobby.html', '/modules/challenge-lobby/challenge-lobby.css', '/modules/challenge-lobby/challenge-lobby.js',
  '/modules/live-quiz/live-quiz.html', '/modules/live-quiz/live-quiz.css', '/modules/live-quiz/live-quiz.js',
  '/modules/live-results/live-results.html', '/modules/live-results/live-results.css', '/modules/live-results/live-results.js',
  // All Services
  '/constants.js',
  '/services/authService.js',
  '/services/geminiService.js',
  '/services/moduleHelper.js',
  '/services/progressService.js',
  '/services/quizStateService.js',
  '/services/soundService.js',
  '/services/stellarMap.js',
  '/services/threeManager.js',
  '/services/topicService.js',
  '/services/uiService.js',
  '/services/achievementService.js',
  '/services/activityFeedService.js',
  '/services/leaderboardService.js',
  '/services/learningPathService.js',
  '/services/libraryService.js',
  '/services/missionService.js',
  '/services/libraryLoader.js', // New service
  // Firebase
  '/firebase-config.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  // Assets
  '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700;800&family=Orbitron:wght@800&display=swap',
  'https://fonts.gstatic.com/s/exo2/v21/7cH1v4okm5zmbvwk_QED-Vk-PA.woff2'
];

// Install the service worker and cache the app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to cache resources during install:', err);
      })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Cache hit - return response
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Not in cache - fetch from network, then cache it for future use
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        
                        // We need to clone the response because it's a stream and can only be consumed once.
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(err => {
                    console.error('Fetch failed; network request error.', err);
                    // Optional: return a fallback offline page if a crucial asset fails and isn't cached
                });
            })
    );
});


// Clean up old caches on activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});