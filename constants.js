
export const LOCAL_STORAGE_KEYS = {
    CONFIG: 'knowledge-tester-config',
    LIBRARY: 'knowledge-tester-library',
    GAME_PROGRESS: 'knowledge-tester-game-progress',
    HISTORY: 'knowledge-tester-history',
    GAMIFICATION: 'knowledge-tester-gamification',
    WELCOME_COMPLETED: 'knowledge-tester-welcome-completed',
};

export const FEATURES = {
    AURAL_MODE: true,
};

export const ROUTES = [
    { path: '/', module: 'home', name: 'Home', icon: 'home', nav: true },
    { path: '/topics', module: 'topic-list', name: 'Journeys', icon: 'git-branch', nav: true },
    { path: '/report', module: 'report', name: 'Analytics', icon: 'activity', nav: true },
    { path: '/library', module: 'library', name: 'Library', icon: 'book', nav: true },
    { path: '/history', module: 'history', name: 'History', icon: 'archive', nav: true },
    { path: '/leaderboard', module: 'leaderboard', name: 'Leaderboard', icon: 'award', nav: true },
    { path: '/profile', module: 'profile', name: 'Profile', icon: 'user', nav: true },
    { path: '/aural', module: 'aural', name: 'Aural Tutor', icon: 'mic', nav: true, fullBleed: true },
    { path: '/settings', module: 'settings', name: 'Settings', icon: 'settings', nav: true, footer: true },
];
