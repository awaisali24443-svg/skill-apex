import { GENERAL_SETTINGS_KEY } from '../constants.js';

// --- DEFAULT SETTINGS ---
// This object defines the default state for all configurable settings.
// New settings should be added here first.
const defaultSettings = {
    theme: 'cyber',
    enableSound: true,
    enable3DBackground: true, // Our new experimental feature is on by default
    // Accessibility settings
    largeText: false,
    highContrast: false,
    dyslexiaFont: false,
};

let currentSettings = {};

/**
 * Loads settings from localStorage or applies defaults.
 */
function loadSettings() {
    try {
        const storedSettings = localStorage.getItem(GENERAL_SETTINGS_KEY);
        if (storedSettings) {
            // Merge stored settings with defaults to ensure all keys are present
            currentSettings = { ...defaultSettings, ...JSON.parse(storedSettings) };
        } else {
            currentSettings = { ...defaultSettings };
        }
    } catch (error) {
        console.error("Failed to load settings from localStorage:", error);
        currentSettings = { ...defaultSettings };
    }
}

/**
 * Saves the current settings object to localStorage.
 */
function saveSettings() {
    try {
        localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(currentSettings));
    } catch (error)
        {
        console.error("Failed to save settings to localStorage:", error);
    }
}

/**
 * Retrieves the value of a specific setting.
 * @param {string} key - The key of the setting to retrieve.
 * @returns {*} The value of the setting, or undefined if not found.
 */
export function getSetting(key) {
    return currentSettings[key];
}

/**
 * Updates the value of a specific setting and saves it.
 * @param {string} key - The key of the setting to update.
 * @param {*} value - The new value for the setting.
 */
export function setSetting(key, value) {
    currentSettings[key] = value;
    saveSettings();
    // Optionally, dispatch a custom event to notify other parts of the app
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key, value } }));
}

/**
 * Returns the entire settings object.
 * @returns {object} The current settings object.
 */
export function getAllSettings() {
    return { ...currentSettings };
}

// --- INITIALIZATION ---
// Load settings as soon as the service is imported.
loadSettings();
