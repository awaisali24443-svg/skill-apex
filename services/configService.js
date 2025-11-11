import { GENERAL_SETTINGS_KEY } from '../constants.js';

const defaultSettings = {
    theme: 'dark',
    enableSound: true,
    enable3DBackground: false,
    largeText: false,
    highContrast: false,
    dyslexiaFont: false,
};

let currentSettings = {};

function loadSettings() {
    // FIX #7: Wrap localStorage access in try...catch
    try {
        const storedSettings = localStorage.getItem(GENERAL_SETTINGS_KEY);
        if (storedSettings) {
            currentSettings = { ...defaultSettings, ...JSON.parse(storedSettings) };
        } else {
            currentSettings = { ...defaultSettings };
        }
    } catch (error) {
        console.warn("Could not access localStorage. Using default settings.", error);
        currentSettings = { ...defaultSettings };
    }
}

function saveSettings() {
    // FIX #7: Wrap localStorage access in try...catch
    try {
        localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(currentSettings));
    } catch (error) {
        console.warn("Could not save settings to localStorage.", error);
    }
}

export function getSetting(key) {
    return currentSettings[key];
}

export function setSetting(key, value) {
    currentSettings[key] = value;
    saveSettings();
    window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key, value } }));
}

export function getAllSettings() {
    return { ...currentSettings };
}

loadSettings();