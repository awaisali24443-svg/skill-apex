import { LOCAL_STORAGE_KEYS } from '../constants.js';

const defaultConfig = {
    theme: 'dark-cyber',
    enableSound: true,
};

let currentConfig = { ...defaultConfig };

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

function saveConfig() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(currentConfig));
        // Dispatch event for other parts of the app to listen to
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: currentConfig }));
    } catch (e) {
        console.error("Failed to save config to localStorage", e);
    }
}

export function init() {
    loadConfig();
}

export function getConfig() {
    return { ...currentConfig };
}

export function setConfig(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
    saveConfig();
}
