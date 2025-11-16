
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
    setState({
        config: configService.getConfig(),
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
    setState({ navigationContext: context });
}

/**
 * Clears the temporary navigation context.
 * Called by the router after a module has initialized.
 */
export function clearNavigationContext() {
    setState({ navigationContext: {} });
}

// Listen for global settings changes to keep the centralized state in sync.
window.addEventListener('settings-changed', (e) => {
    setState({ config: e.detail });
});
