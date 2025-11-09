import * as progressService from '../../services/progressService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { logOut } from '../../services/authService.js';
import { ACCESSIBILITY_SETTINGS_KEY, GENERAL_SETTINGS_KEY, SELECTED_THEME_KEY } from '../../constants.js';

let sceneManager;
let initialProfileState = { username: '', bio: '' };
const themes = ['dark', 'light', 'cyber'];

// --- Event Handlers ---
const checkProfileChanges = () => {
    const usernameInput = document.getElementById('username');
    const profileBioInput = document.getElementById('profile-bio');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const hasChanged = usernameInput.value !== initialProfileState.username || profileBioInput.value !== initialProfileState.bio;
    saveProfileBtn.disabled = !hasChanged;
};

const saveProfile = async () => {
    const usernameInput = document.getElementById('username');
    const profileBioInput = document.getElementById('profile-bio');
    const profilePictureImg = document.getElementById('profile-picture');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const btnText = saveProfileBtn.querySelector('.btn-text');
    const spinner = saveProfileBtn.querySelector('.spinner');

    saveProfileBtn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    const profileData = {
        username: usernameInput.value.trim(),
        bio: profileBioInput.value.trim(),
        pictureURL: profilePictureImg.src
    };
    try {
        await progressService.updateUserProfile(profileData);
        initialProfileState.username = profileData.username;
        initialProfileState.bio = profileData.bio;
        window.showToast('✅ Profile saved successfully!');
        await window.updateHeaderStats();
    } catch (error) {
        window.showToast('❌ Failed to save profile.', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        saveProfileBtn.disabled = true; // Still disabled as there are no new changes
    }
};

const editProfilePicture = async () => {
    const profilePictureImg = document.getElementById('profile-picture');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const newUrl = await window.showConfirmationModal({
        title: "Edit Profile Picture",
        text: "Enter a new image URL for your profile picture:",
        confirmText: "Save",
        isPrompt: true,
        promptValue: profilePictureImg.src
    });

    if (newUrl) {
        profilePictureImg.src = newUrl;
        saveProfileBtn.disabled = false; 
    }
};

const handleGeneralSettingsChange = (e) => {
    const { id, checked } = e.target;
    const settings = JSON.parse(localStorage.getItem(GENERAL_SETTINGS_KEY) || '{}');
    if (id === 'sound-toggle') settings.soundEnabled = checked;
    localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings));
};

const handleAccessibilityChange = (e) => {
    const { id, checked } = e.target;
    const settings = JSON.parse(localStorage.getItem(ACCESSIBILITY_SETTINGS_KEY) || '{}');
    let bodyClass = '', settingKey = '';

    switch (id) {
        case 'large-text-toggle': bodyClass = 'large-text'; settingKey = 'largeText'; break;
        case 'high-contrast-toggle': bodyClass = 'high-contrast'; settingKey = 'highContrast'; break;
        case 'dyslexia-font-toggle': bodyClass = 'dyslexia-font'; settingKey = 'dyslexiaFont'; break;
        case 'reduce-motion-toggle': bodyClass = 'reduce-motion'; settingKey = 'reduceMotion'; break;
    }

    if (bodyClass) {
        document.body.classList.toggle(bodyClass, checked);
        settings[settingKey] = checked;
        localStorage.setItem(ACCESSIBILITY_SETTINGS_KEY, JSON.stringify(settings));
    }
};

const handleResetProgress = async () => {
    const isConfirmed = await window.showConfirmationModal({
        title: "Confirm Data Reset",
        text: "Are you sure? This will permanently delete your scores and reset all topics back to Level 1. This action cannot be undone.",
        confirmText: "Reset Progress",
    });

    if (isConfirmed) {
        try {
            await progressService.resetUserProgress();
            await window.showConfirmationModal({
                title: "Progress Reset", text: "Your progress has been reset. You will now be logged out.", isAlert: true
            });
            await logOut();
            window.location.hash = '#login';
        } catch (error) {
            window.showToast("An error occurred while resetting progress.", "error");
        }
    }
};

const handleGoPro = async () => {
    await window.showConfirmationModal({
        title: "Feature Coming Soon!", text: "Pro features are currently in development. Thank you for your interest!", isAlert: true
    });
};

const handleThemeChange = (e) => {
    const selectedTheme = e.target.value;
    document.body.classList.add('theme-transitioning');
    document.documentElement.setAttribute('data-theme', selectedTheme);
    localStorage.setItem(SELECTED_THEME_KEY, selectedTheme);
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 150);
};

// --- Lifecycle Functions ---
async function loadData() {
    // Profile
    const progress = await progressService.getProgress();
    if (progress) {
        initialProfileState.username = progress.username || '';
        initialProfileState.bio = progress.bio || '';
        document.getElementById('username').value = initialProfileState.username;
        document.getElementById('profile-bio').value = initialProfileState.bio;
        document.getElementById('profile-picture').src = progress.pictureURL || 'https://avatar.iran.liara.run/public/boy';
    }
    document.getElementById('username').disabled = false;
    document.getElementById('profile-bio').disabled = false;
    document.getElementById('save-profile-btn').disabled = true;

    // General Settings
    const generalSettings = JSON.parse(localStorage.getItem(GENERAL_SETTINGS_KEY) || '{}');
    document.getElementById('sound-toggle').checked = generalSettings.soundEnabled ?? true;

    // Accessibility Settings
    const accessibilitySettings = JSON.parse(localStorage.getItem(ACCESSIBILITY_SETTINGS_KEY) || '{}');
    document.getElementById('large-text-toggle').checked = accessibilitySettings.largeText || false;
    document.getElementById('high-contrast-toggle').checked = accessibilitySettings.highContrast || false;
    document.getElementById('dyslexia-font-toggle').checked = accessibilitySettings.dyslexiaFont || false;
    document.getElementById('reduce-motion-toggle').checked = accessibilitySettings.reduceMotion || false;

    // Theme
    const savedTheme = localStorage.getItem(SELECTED_THEME_KEY) || 'light';
    if (themes.includes(savedTheme)) {
      document.getElementById('theme-selector').value = savedTheme;
    }
}

export function init() {
    loadData();
    sceneManager = initModuleScene('.background-canvas', 'calmGeometric');

    // Add all event listeners
    document.getElementById('username')?.addEventListener('input', checkProfileChanges);
    document.getElementById('profile-bio')?.addEventListener('input', checkProfileChanges);
    document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);
    document.getElementById('edit-picture-btn')?.addEventListener('click', editProfilePicture);
    document.getElementById('reset-progress-btn')?.addEventListener('click', handleResetProgress);
    document.getElementById('go-pro-btn')?.addEventListener('click', handleGoPro);
    document.getElementById('theme-selector')?.addEventListener('change', handleThemeChange);
    document.getElementById('sound-toggle')?.addEventListener('change', handleGeneralSettingsChange);
    document.getElementById('large-text-toggle')?.addEventListener('change', handleAccessibilityChange);
    document.getElementById('high-contrast-toggle')?.addEventListener('change', handleAccessibilityChange);
    document.getElementById('dyslexia-font-toggle')?.addEventListener('change', handleAccessibilityChange);
    document.getElementById('reduce-motion-toggle')?.addEventListener('change', handleAccessibilityChange);
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    // Remove all event listeners
    document.getElementById('username')?.removeEventListener('input', checkProfileChanges);
    document.getElementById('profile-bio')?.removeEventListener('input', checkProfileChanges);
    document.getElementById('save-profile-btn')?.removeEventListener('click', saveProfile);
    document.getElementById('edit-picture-btn')?.removeEventListener('click', editProfilePicture);
    document.getElementById('reset-progress-btn')?.removeEventListener('click', handleResetProgress);
    document.getElementById('go-pro-btn')?.removeEventListener('click', handleGoPro);
    document.getElementById('theme-selector')?.removeEventListener('change', handleThemeChange);
    document.getElementById('sound-toggle')?.removeEventListener('change', handleGeneralSettingsChange);
    document.getElementById('large-text-toggle')?.removeEventListener('change', handleAccessibilityChange);
    document.getElementById('high-contrast-toggle')?.removeEventListener('change', handleAccessibilityChange);
    document.getElementById('dyslexia-font-toggle')?.removeEventListener('change', handleAccessibilityChange);
    document.getElementById('reduce-motion-toggle')?.removeEventListener('change', handleAccessibilityChange);
}
