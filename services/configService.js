
import { LOCAL_STORAGE_KEYS } from '../constants.js';

const defaultConfig = {
    theme: 'light-cyber', // Forced default
    enableSound: true,
    animationIntensity: 'full', 
    aiPersona: 'apex' 
};

let currentConfig = { ...defaultConfig };

function loadConfig() {
    try {
        const storedConfig = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
        if (storedConfig) {
            currentConfig = { ...defaultConfig, ...JSON.parse(storedConfig) };
            // Ensure we override theme even if user had one saved, to enforce the design request
            currentConfig.theme = 'light-cyber'; 
        }
    } catch (e) {
        console.error("Failed to load config", e);
        currentConfig = { ...defaultConfig };
    }
}

function saveConfig() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(currentConfig));
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: currentConfig }));
    } catch (e) {
        console.error("Failed to save config", e);
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
