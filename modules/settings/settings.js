import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { isGuest } from '../../services/authService.js';
import { showToast } from '../../services/uiService.js';

let sceneManager;

const settings = {
    theme: 'cyber',
    soundEnabled: true,
    'large-text': false,
    'high-contrast': false,
    'dyslexia-font': false,
    'reduce-motion': false,
};

function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
    Object.assign(settings, savedSettings);

    // Apply settings to UI elements
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('sound-toggle').checked = settings.soundEnabled;
    document.getElementById('large-text-toggle').checked = settings['large-text'];
    document.getElementById('high-contrast-toggle').checked = settings['high-contrast'];
    document.getElementById('dyslexia-font-toggle').checked = settings['dyslexia-font'];
    document.getElementById('reduce-motion-toggle').checked = settings['reduce-motion'];

    applyAllSettings();
}

function saveSettings() {
    localStorage.setItem('generalSettings', JSON.stringify(settings));
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function applyAccessibilityClasses() {
    const body = document.body;
    body.classList.toggle('large-text', settings['large-text']);
    body.classList.toggle('high-contrast', settings['high-contrast']);
    body.classList.toggle('dyslexia-font', settings['dyslexia-font']);
    body.classList.toggle('reduce-motion', settings['reduce-motion']);
}

function applyAllSettings() {
    applyTheme(settings.theme);
    applyAccessibilityClasses();
}

function handleThemeChange(e) {
    settings.theme = e.target.value;
    document.body.classList.add('theme-transitioning');
    applyTheme(settings.theme);
    saveSettings();
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 600);
}

function handleToggleChange(e) {
    const key = e.target.id.replace('-toggle', '');
    settings[key] = e.target.checked;
    saveSettings();
    applyAccessibilityClasses();
}

async function handleResetProgress() {
    if (isGuest()) {
        const confirmed = await window.showConfirmationModal({
            title: 'Reset Guest Progress?',
            text: 'This will erase all your progress for this session. This action cannot be undone.',
            confirmText: 'Reset Progress'
        });
        if (confirmed) {
            localStorage.removeItem('guestProgress');
            localStorage.removeItem('guestMissions');
            localStorage.removeItem('guestLibrary');
            localStorage.removeItem('guestLearningPaths');
            showToast('Guest progress has been reset.', 'success');
            // A page reload is easiest to reflect changes everywhere
            window.location.reload();
        }
    } else {
         await window.showConfirmationModal({
            title: 'Feature Not Available',
            text: 'Account management features require a Firebase connection, which is not currently enabled in this demo.',
            isAlert: true
        });
    }
}

async function handleDeleteAccount() {
    await window.showConfirmationModal({
        title: 'Feature Not Available',
        text: 'Account management features require a Firebase connection, which is not currently enabled in this demo.',
        isAlert: true
    });
}


function addEventListeners() {
    document.getElementById('theme-select')?.addEventListener('change', handleThemeChange);
    document.getElementById('sound-toggle')?.addEventListener('change', (e) => {
        settings.soundEnabled = e.target.checked;
        saveSettings();
    });
    document.querySelectorAll('.accessibility-options .toggle-switch').forEach(toggle => {
        toggle.addEventListener('change', handleToggleChange);
    });
    document.getElementById('reset-progress-btn')?.addEventListener('click', handleResetProgress);
    document.getElementById('delete-account-btn')?.addEventListener('click', handleDeleteAccount);
}

export function init() {
    sceneManager = initModuleScene('.background-canvas', 'calmGeometric');
    if (isGuest()) {
        document.querySelector('.profile-header').innerHTML = '<p>Sign up to create a profile and save your settings!</p>';
        document.querySelector('.go-pro-section').style.display = 'none';
        document.getElementById('delete-account-btn').style.display = 'none';
    }
    loadSettings();
    addEventListeners();
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}