
import * as configService from './configService.js';

/**
 * A simple, centralized state management service for the application.
 */

// The single source of truth for the application state.
let state = {
    // Navigation & context
    currentRoute: null,
    routeParams: {},
    navigationContext: {}, // For passing temporary data between routes (e.g., topic for a new quiz)
};

const subscribers = new Set();
const SESSION_STORAGE_KEY = 'kt_nav_context';

/**
 * Merges the new partial state with the current state and notifies subscribers.
 * @param {object} partialState - The part of the state to update.
 * @param {boolean} [notify=true] - Whether to notify subscribers of the change.
 * @private
 */
function setState(partialState, notify = true) {
    const oldState = { ...state };
    state = { ...state, ...partialState };
    if (notify) {
        // Use a microtask to batch updates and prevent re-entrant calls
        queueMicrotask(() => {
            subscribers.forEach(callback => callback(state, oldState));
        });
    }
}

/**
 * Initializes the state by loading data from various services.
 * This should be called once on application startup.
 */
export function initState() {
    // Attempt to recover navigation context from session storage
    let recoveredContext = {};
    try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
            recoveredContext = JSON.parse(stored);
        }
    } catch(e) {
        console.warn("Failed to recover session state", e);
    }

    setState({
        config: configService.getConfig(),
        navigationContext: recoveredContext
    }, false); // Don't notify on initial load
}

/**
 * Returns a copy of the current application state.
 * @returns {object} The current state.
 */
export function getState() {
    return { 
        ...state,
        // Ensure some state is always fresh from its source service
        config: configService.getConfig(),
    };
}

/**
 * Subscribes a callback function to state changes.
 * @param {function} callback - The function to call when state changes.
 * @returns {function} An unsubscribe function.
 */
export function subscribe(callback) {
    subscribers.add(callback);
    return () => {
        subscribers.delete(callback);
    };
}

// --- Specific State Updaters ---

/**
 * Updates the current route information in the state.
 * @param {object} route - The matched route object from constants.js.
 */
export function setCurrentRoute(route) {
    setState({
        currentRoute: route,
        routeParams: route.params || {}
    });
}

/**
 * Sets temporary context for the next navigation.
 * This is intended for one-time data passing between modules.
 * @param {object} context - The data to pass to the next module.
 */
export function setNavigationContext(context) {
    // Persist to session storage so we don't lose where we are if user refreshes
    try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(context));
    } catch(e) { console.error("Session write failed", e); }

    setState({ navigationContext: context });
}

/**
 * Clears the temporary navigation context.
 * Called by the router after a module has initialized.
 */
export function clearNavigationContext() {
    // NOTE: We do NOT clear session storage here automatically anymore.
    // We want the context to persist for reloads.
    // Modules that consume context should clear it explicitly if they are done with it, 
    // or we assume it stays valid until overwritten.
}

// Listen for global settings changes to keep the centralized state in sync.
window.addEventListener('settings-changed', (e) => {
    setState({ config: e.detail });
});
