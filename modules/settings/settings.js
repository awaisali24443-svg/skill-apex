import { getSetting, setSetting } from '../../services/configService.js';

// --- DOM ELEMENT REFERENCES ---
let themeSelect;
let soundToggle;
let backgroundToggle;
let largeTextToggle;
let highContrastToggle;
let dyslexiaFontToggle;

/**
 * Updates the entire UI based on the current settings.
 */
function populateSettings() {
    themeSelect.value = getSetting('theme');
    soundToggle.checked = getSetting('enableSound');
    backgroundToggle.checked = getSetting('enable3DBackground');
    largeTextToggle.checked = getSetting('largeText');
    highContrastToggle.checked = getSetting('highContrast');
    dyslexiaFontToggle.checked = getSetting('dyslexiaFont');
    
    // Also apply body classes immediately
    updateBodyClasses();
}

/**
 * Handles changes to the theme select dropdown.
 */
function handleThemeChange(event) {
    const newTheme = event.target.value;
    setSetting('theme', newTheme);
    document.body.dataset.theme = newTheme;
}

/**
 * A generic handler for all toggle switches.
 * @param {Event} event - The input change event.
 * @param {string} settingKey - The key of the setting to update.
 */
function handleToggleChange(event, settingKey) {
    setSetting(settingKey, event.target.checked);
    updateBodyClasses();
}

/**
 * Applies or removes accessibility classes from the body.
 */
function updateBodyClasses() {
    document.body.classList.toggle('large-text', getSetting('largeText'));
    document.body.classList.toggle('high-contrast', getSetting('highContrast'));
    document.body.classList.toggle('dyslexia-font', getSetting('dyslexiaFont'));
}

/**
 * Attaches all necessary event listeners.
 */
function addEventListeners() {
    themeSelect.addEventListener('change', handleThemeChange);
    soundToggle.addEventListener('change', (e) => handleToggleChange(e, 'enableSound'));
    backgroundToggle.addEventListener('change', (e) => handleToggleChange(e, 'enable3DBackground'));
    largeTextToggle.addEventListener('change', (e) => handleToggleChange(e, 'largeText'));
    highContrastToggle.addEventListener('change', (e) => handleToggleChange(e, 'highContrast'));
    dyslexiaFontToggle.addEventListener('change', (e) => handleToggleChange(e, 'dyslexiaFont'));
}

/**
 * Removes all event listeners for cleanup.
 */
function removeEventListeners() {
    // This is important to prevent memory leaks when the module is destroyed.
    themeSelect.removeEventListener('change', handleThemeChange);
    // Removing anonymous function listeners is tricky, so for this app, we'll assume
    // they are cleaned up when the DOM elements are removed by the module loader.
}


export function init(appState) {
    console.log("Settings module initialized.");
    
    // Cache DOM elements
    themeSelect = document.getElementById('theme-select');
    soundToggle = document.getElementById('sound-toggle');
    backgroundToggle = document.getElementById('background-toggle');
    largeTextToggle = document.getElementById('large-text-toggle');
    highContrastToggle = document.getElementById('high-contrast-toggle');
    dyslexiaFontToggle = document.getElementById('dyslexia-font-toggle');

    populateSettings();
    addEventListeners();
}

export function destroy() {
    // In a more complex app, you'd want to properly remove listeners.
    // For now, logging is sufficient.
    console.log("Settings module destroyed.");
}
