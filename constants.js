
// --- Routing ---
// FIX #2: Simplified routes for the new dynamic router
export const ROUTES = [
    { hash: 'home', module: 'home', name: 'Home', inNav: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path></svg>' },
    { hash: 'explore', module: 'explore-topics', name: 'Explore', inNav: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg>' },
    { hash: 'custom-quiz', module: 'optional-quiz-generator', name: 'Custom Quiz', inNav: false },
    { hash: 'paths', module: 'learning-path', name: 'Learning Paths', inNav: false },
    { hash: 'library', module: 'library', name: 'My Library', inNav: false },
    { hash: 'study', module: 'study', name: 'Study Mode', inNav: false },
    { hash: 'topics/:categoryId', module: 'topic-list', name: 'Topic List', inNav: false },
    { hash: 'settings', module: 'settings', name: 'Settings', inNav: true, icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59-1.69.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"></path></svg>' },
    { hash: 'loading', module: 'loading', name: 'Loading', inNav: false },
    { hash: 'quiz', module: 'quiz', name: 'Quiz', inNav: false },
    { hash: 'results', module: 'results', name: 'Results', inNav: false },
    { hash: 'profile', module: 'profile', name: 'Profile', inNav: false },
    { hash: 'time-challenge', module: 'time-challenge', name: 'Time Challenge', inNav: false },
    { hash: 'placeholder', module: 'placeholder', name: 'Coming Soon', inNav: false },
];

// --- Quiz Settings ---
export const NUM_QUESTIONS = 10;
export const PASSING_SCORE_PERCENTAGE = 70;

// --- Local Storage Keys ---
export const GENERAL_SETTINGS_KEY = 'knowledgeTester_settings';
export const LIBRARY_KEY_GUEST = 'knowledgeTester_library_guest';
export const LEARNING_PATH_PROGRESS_GUEST = 'knowledgeTester_learningPath_guest';

// --- Session Storage Key ---
export const APP_STATE_KEY = 'knowledgeTester_appState';
