

export const LOCAL_STORAGE_KEYS = {
    CONFIG: 'knowledge-tester-config',
    LIBRARY: 'knowledge-tester-library',
    LEARNING_PATHS: 'knowledge-tester-learning-paths',
    HISTORY: 'knowledge-tester-history',
    GAMIFICATION: 'knowledge-tester-gamification',
};

export const ROUTES = [
    { path: '/', module: 'home', name: 'Home', icon: 'home', nav: true },
    { path: '/topics', module: 'topic-list', name: 'Journeys', icon: 'grid', nav: true },
    { path: '/profile', module: 'profile', name: 'Profile', icon: 'user', nav: true },
    { path: '/loading', module: 'loading', name: 'Loading', nav: false },
    { path: '/quiz', module: 'quiz', name: 'Quiz', nav: false },
    { path: '/results', module: 'results', name: 'Results', nav: false },
    { path: '/library', module: 'library', name: 'Library', icon: 'book', nav: true },
    { path: '/history', module: 'history', name: 'History', icon: 'archive', nav: true },
    { path: '/study', module: 'study', name: 'Study', nav: false },
    { path: '/aural', module: 'aural', name: 'Aural', icon: 'mic', nav: true, fullBleed: true },
    { path: '/learning-path/:id', module: 'learning-path', name: 'Learning Path', nav: false },
    { path: '/settings', module: 'settings', name: 'Settings', icon: 'settings', nav: true, footer: true },
];

// Simple feature flags
export const FEATURES = {
    LEARNING_PATHS: true,
    AURAL_MODE: true,
};