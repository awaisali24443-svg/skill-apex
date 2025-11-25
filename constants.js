




export const LOCAL_STORAGE_KEYS = {
    CONFIG: 'knowledge-tester-config',
    LIBRARY: 'knowledge-tester-library',
    GAME_PROGRESS: 'knowledge-tester-game-progress',
    HISTORY: 'knowledge-tester-history',
    GAMIFICATION: 'knowledge-tester-gamification',
    WELCOME_COMPLETED: 'knowledge-tester-welcome-completed',
};

// Re-enabling all features and routes for the full application experience.
export const FEATURES = {
    AURAL_MODE: true,
};

export const ROUTES = [
    // Main navigation routes
    { path: '/', module: 'home', name: 'Home', icon: 'home', nav: true },
    { path: '/topics', module: 'topic-list', name: 'Explore & Create', icon: 'grid', nav: true }, // Renamed from Journeys
    { path: '/profile', module: 'profile', name: 'My Progress', icon: 'award', nav: true }, // Renamed from Profile
    { path: '/library', module: 'library', name: 'Saved Items', icon: 'book', nav: true }, // Renamed from Library
    { path: '/aural', module: 'aural', name: 'AI Tutor', icon: 'mic', nav: true, fullBleed: true },

    // Footer/Settings routes
    { path: '/settings', module: 'settings', name: 'Settings', icon: 'settings', nav: true, footer: true },
    // Help is handled via a special button in sidebarService, not a route

    // Non-navigational routes (part of application flow)
    { path: '/history', module: 'history', name: 'Full History', icon: 'archive', nav: false }, // Moved out of main nav to simplify
    { path: '/study', module: 'study', name: 'Study Session', nav: false },
    { path: '/game/:topic', module: 'game-map', name: 'Game Map', nav: false },
    { path: '/level', module: 'game-level', name: 'Game Level', nav: false, fullBleed: true },
    { path: '/review', module: 'quiz-review', name: 'Quiz Review', nav: false },
];