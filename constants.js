
export const LOCAL_STORAGE_KEYS = {
    CONFIG: 'knowledge-tester-config',
    LIBRARY: 'knowledge-tester-library',
    GAME_PROGRESS: 'knowledge-tester-game-progress',
    HISTORY: 'knowledge-tester-history',
    GAMIFICATION: 'knowledge-tester-gamification',
    WELCOME_COMPLETED: 'knowledge-tester-welcome-completed',
};

// Features config
export const FEATURES = {
    AURAL_MODE: true, // Re-enabled Aural Mode
};

export const ROUTES = [
    // Dashboard & Navigation
    { path: '/', module: 'home', name: 'Dashboard', icon: 'home', nav: true },
    { path: '/topics', module: 'topic-list', name: 'Protocols', icon: 'grid', nav: true },
    { path: '/library', module: 'library', name: 'Library', icon: 'book', nav: true },
    { path: '/history', module: 'history', name: 'History', icon: 'clock', nav: true },
    
    // Feature Modules
    { path: '/profile', module: 'profile', name: 'Identity', icon: 'user', nav: true },
    { path: '/settings', module: 'settings', name: 'Config', icon: 'settings', nav: true, footer: true },
    
    // Hidden / Action Routes
    { path: '/game/:topic', module: 'game-map', name: 'Mission Map', nav: false, fullBleed: true },
    { path: '/level', module: 'game-level', name: 'Active Simulation', nav: false, fullBleed: true },
    { path: '/review', module: 'quiz-review', name: 'After Action Report', nav: false },
    { path: '/study', module: 'study', name: 'Memory Consolidation', nav: false, fullBleed: true },
    { path: '/report', module: 'report', name: 'Performance Analysis', nav: false },
    { path: '/aural', module: 'aural', name: 'Neural Link', nav: false, fullBleed: true },
];
