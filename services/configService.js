
import { LOCAL_STORAGE_KEYS } from '../constants.js';
// Theme application is now handled directly by the settings UI module to improve separation of concerns.

const defaultConfig = {
    theme: 'dark-cyber',
    enableSound: true,
    animationIntensity: 'full', // 'off', 'subtle', 'full'
    aiPersona: 'apex' // 'apex', 'sage', 'commander', 'eli5'
};

let currentConfig = { ...defaultConfig };

/**
 * Loads the user configuration from localStorage.
 * If no configuration is found, it falls back to the default.
 * @private
 */
function loadConfig() {
    try {
        const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
        if (storedConfig) {
            currentConfig = { ...defaultConfig, ...JSON.parse(storedConfig) };
        }
    } catch (e) {
        console.error("Failed to load config from localStorage", e);
        currentConfig = { ...defaultConfig };
    }
}

/**
 * Saves the current configuration to localStorage.
 * @private
 */
function saveConfig() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(currentConfig));
        // Dispatch a custom event to notify other parts of the app about the change.
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: currentConfig }));
    } catch (e) {
        console.error("Failed to save config to localStorage", e);
    }
}

/**
 * Initializes the configuration service by loading settings from localStorage.
 * Should be called once on application startup.
 */
export function init() {
    loadConfig();
}

/**
 * Gets a copy of the current application configuration.
 * @returns {object} The current configuration object.
 */
export function getConfig() {
    return { ...currentConfig };
}

/**
 * Updates the application configuration with new settings.
 * @param {object} newConfig - An object containing the configuration keys to update.
 */
export function setConfig(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
    saveConfig();
}
