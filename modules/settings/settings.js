import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';

let soundToggle;
let clearDataBtn;

function loadSettings() {
    const config = configService.getConfig();
    soundToggle.checked = config.enableSound;
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: soundToggle.checked });
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

    loadSettings();

    soundToggle.addEventListener('change', handleSoundToggle);
    clearDataBtn.addEventListener('click', handleClearData);
}

export function destroy() {
    if(soundToggle) soundToggle.removeEventListener('change', handleSoundToggle);
    if(clearDataBtn) clearDataBtn.removeEventListener('click', handleClearData);
}
