
import * as configService from './configService.js';

let state = {
    currentRoute: null,
    routeParams: {},
    navigationContext: {},
};

const subscribers = new Set();
const SESSION_STORAGE_KEY = 'skill_apex_session_state';

/**
 * Initializes the state and recovers session data if it exists.
 */
export function initState() {
    let recoveredContext = {};
    try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
            recoveredContext = JSON.parse(stored);
        }
        
        // MPA URL Recovery: If parameters are in URL, they take priority
        const params = new URLSearchParams(window.location.search);
        if (params.has('topic')) {
            recoveredContext.topic = params.get('topic');
            recoveredContext.level = parseInt(params.get('level')) || recoveredContext.level;
        }
    } catch(e) { console.warn("State Recovery Failed", e); }

    state.navigationContext = recoveredContext;
    state.config = configService.getConfig();
}

export function getState() {
    return { ...state };
}

export function setNavigationContext(context) {
    state.navigationContext = { ...state.navigationContext, ...context };
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.navigationContext));
    } catch(e) {}
}

export function clearNavigationContext() {
    state.navigationContext = {};
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}
