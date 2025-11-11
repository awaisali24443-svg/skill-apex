

import { getSetting, setSetting, getAllSettings } from '../../services/configService.js';
import { LIBRARY_KEY_GUEST, LEARNING_PATH_PROGRESS_GUEST } from '../../constants.js';
import { modalService } from '../../services/modalService.js';
import { toastService } from '../../services/toastService.js'; // Import toast service

let themeSelect, soundToggle;
let largeTextToggle, highContrastToggle, dyslexiaFontToggle;
let clearDataBtn;

// FIX #8: Use named functions for event listeners to allow for removal
const handleThemeChange = (e) => setSetting('theme', e.target.value);
const handleToggleChange = (e) => {
    const key = e.target.dataset.key;
    if (key) {
        setSetting(key, e.target.checked);
    }
};

const handleClearData = async () => {
    // FIX #25: Use custom modal for confirmation
    const confirmed = await modalService.confirm({
        title: 'Clear All Guest Data?',
        message: 'This will permanently remove your quiz history, saved library items, and learning path progress. This action cannot be undone.',
        confirmText: 'Yes, Clear Data'
    });

    if (confirmed) {
        try {
            localStorage.removeItem(LIBRARY_KEY_GUEST);
            localStorage.removeItem(LEARNING_PATH_PROGRESS_GUEST);
            // Optionally, clear other guest-related keys here
            
            // Provide better feedback to the user using toast notifications
            toastService.show("Your guest data has been cleared.");
        } catch (error) {
            console.error("Failed to clear guest data:", error);
            toastService.show("There was an error clearing your data.", "error");
        }
    }
};

const updateBodyClasses = () => {
    const settings = getAllSettings();
    document.body.classList.toggle('large-text', settings.largeText);
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('dyslexia-font', settings.dyslexiaFont);
    document.body.setAttribute('data-theme', settings.theme);
};

export function init() {
    console.log("Settings module initialized.");
    
    // --- Query elements ---
    themeSelect = document.getElementById('theme-select');
    soundToggle = document.getElementById('sound-toggle');
    largeTextToggle = document.getElementById('large-text-toggle');
    highContrastToggle = document.getElementById('high-contrast-toggle');
    dyslexiaFontToggle = document.getElementById('dyslexia-font-toggle');
    clearDataBtn = document.getElementById('clear-guest-data-btn');

    // Assign data-keys for the generic toggle handler
    soundToggle.dataset.key = 'enableSound';
    largeTextToggle.dataset.key = 'largeText';
    highContrastToggle.dataset.key = 'highContrast';
    dyslexiaFontToggle.dataset.key = 'dyslexiaFont';
    
    // --- Populate UI from settings ---
    const settings = getAllSettings();
    themeSelect.value = settings.theme;
    soundToggle.checked = settings.enableSound;
    largeTextToggle.checked = settings.largeText;
    highContrastToggle.checked = settings.highContrast;
    dyslexiaFontToggle.checked = settings.dyslexiaFont;
    
    // --- Attach event listeners ---
    themeSelect.addEventListener('change', handleThemeChange);
    soundToggle.addEventListener('change', handleToggleChange);
    largeTextToggle.addEventListener('change', handleToggleChange);
    highContrastToggle.addEventListener('change', handleToggleChange);
    dyslexiaFontToggle.addEventListener('change', handleToggleChange);
    clearDataBtn.addEventListener('click', handleClearData);
    
    // Initial application of classes
    updateBodyClasses();
}

export function destroy() {
    // FIX #8, #22: Properly remove all event listeners on cleanup
    if (themeSelect) themeSelect.removeEventListener('change', handleThemeChange);
    if (soundToggle) soundToggle.removeEventListener('change', handleToggleChange);
    if (largeTextToggle) largeTextToggle.removeEventListener('change', handleToggleChange);
    if (highContrastToggle) highContrastToggle.removeEventListener('change', handleToggleChange);
    if (dyslexiaFontToggle) dyslexiaFontToggle.removeEventListener('change', handleToggleChange);
    if (clearDataBtn) clearDataBtn.removeEventListener('click', handleClearData);
    
    console.log("Settings module destroyed and listeners removed.");
}