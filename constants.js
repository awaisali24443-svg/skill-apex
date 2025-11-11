

// --- Routing ---
// FIX #2: Simplified routes for the new dynamic router
export const ROUTES = [
    { hash: 'home', module: 'home', name: 'Home', inNav: true },
    { hash: 'custom-quiz', module: 'optional-quiz-generator', name: 'Custom Quiz', inNav: true },
    { hash: 'explore', module: 'explore-topics', name: 'Explore', inNav: false },
    { hash: 'topics/:categoryId', module: 'topic-list', name: 'Topic List', inNav: false },
    { hash: 'paths', module: 'learning-path', name: 'Learning Paths', inNav: false },
    { hash: 'library', module: 'library', name: 'My Library', inNav: false },
    { hash: 'study', module: 'study', name: 'Study Mode', inNav: false },
    { hash: 'settings', module: 'settings', name: 'Settings', inNav: true },
    { hash: 'loading', module: 'loading', name: 'Loading', inNav: false },
    { hash: 'quiz', module: 'quiz', name: 'Quiz', inNav: false },
    { hash: 'results', module: 'results', name: 'Results', inNav: false },
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