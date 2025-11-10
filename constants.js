// --- Quiz & Gameplay Constants ---
export const NUM_QUESTIONS = 5;
export const MAX_LEVEL = 50;
export const UNLOCK_SCORE = 3; // Number of correct answers to unlock next level/step

// --- Routing Configuration ---
export const ROUTES = {
    'welcome': { module: 'welcome' },
    'login': { module: 'login' },
    'signup': { module: 'signup' },
    'home': { module: 'home' },
    'tutor': { module: 'tutor' },
    'explore-topics': { module: 'explore-topics' },
    'topics': { module: 'topic-list', context: { category: 'programming' } },
    'topics/programming': { module: 'topic-list', context: { category: 'programming' } },
    'topics/science': { module: 'topic-list', context: { category: 'science' } },
    'topics/technology': { module: 'topic-list', context: { category: 'technology' } },
    'custom-quiz': { module: 'optional-quiz-generator' },
    'loading': { module: 'loading' },
    'quiz': { module: 'quiz' },
    'results': { module: 'results' },
    'study': { module: 'study' },
    'challenge-setup': { module: 'challenge-setup' },
    'challenge-results': { module: 'challenge-results' },
    'leaderboard': { module: 'leaderboard' },
    'progress': { module: 'progress' },
    'settings': { module: 'settings' },
    'learning-path': { module: 'learning-path' },
    'library': { module: 'library' },
    // Live Challenge Routes (require login)
    'challenge-lobby': { module: 'challenge-lobby' },
    'live-quiz': { module: 'live-quiz' },
    'live-results': { module: 'live-results' },
};

// --- Local Storage & Session Keys ---
export const MODULE_CONTEXT_KEY = 'moduleContext';
export const QUIZ_STATE_KEY = 'quizInProgress';
export const GENERAL_SETTINGS_KEY = 'generalSettings';
// Guest Mode Data Keys
export const GUEST_PROGRESS_KEY = 'guestProgress';
export const GUEST_MISSIONS_KEY = 'guestMissions';
export const GUEST_LIBRARY_KEY = 'guestLibrary';
export const GUEST_PATHS_KEY = 'guestLearningPaths';