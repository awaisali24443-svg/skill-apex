import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';

let soundToggle;
let clearDataBtn;
let themeToggle;

function loadSettings() {
    const config = configService.getConfig();
    soundToggle.checked = config.enableSound;

    document.querySelectorAll('#theme-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === config.theme);
    });
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: soundToggle.checked });
}

function handleThemeToggle(event) {
    const button = event.target.closest('button[data-theme]');
    if (button) {
        const newTheme = button.dataset.theme;
        configService.setConfig({ theme: newTheme });
        // The 'settings-changed' event will trigger the themeService to update the CSS
        loadSettings(); // Instantly update the active button style
    }
}

async function handleClearData() {
    const confirmed = await showConfirmationModal({
        title: 'Confirm Data Deletion',
        message: 'Are you sure you want to delete all your saved questions, learning paths, and settings? This action cannot be undone.',
        confirmText: 'Yes, Delete Everything',
    });

    if (confirmed) {
        Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        showToast('All application data has been cleared.', 'success');
        // Reload the app to reflect changes
        setTimeout(() => window.location.reload(), 1000);
    }
}

export function init(appState) {
    soundToggle = document.getElementById('sound-toggle');
    clearDataBtn = document.getElementById('clear-data-btn');
    themeToggle = document.getElementById('theme-toggle');

    loadSettings();

    soundToggle.addEventListener('change', handleSoundToggle);
    clearDataBtn.addEventListener('click', handleClearData);
    themeToggle.addEventListener('click', handleThemeToggle);
}

export function destroy() {
    if(soundToggle) soundToggle.removeEventListener('change', handleSoundToggle);
    if(clearDataBtn) clearDataBtn.removeEventListener('click', handleClearData);
    if(themeToggle) themeToggle.removeEventListener('click', handleThemeToggle);
}