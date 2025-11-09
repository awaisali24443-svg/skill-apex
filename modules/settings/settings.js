import * as progressService from '../../services/progressService.js';

console.log("Settings/Profile module loaded.");

// --- DOM Elements ---
const displayNameInput = document.getElementById('display-name');
const profileBioInput = document.getElementById('profile-bio');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profilePictureImg = document.getElementById('profile-picture');
const editPictureBtn = document.getElementById('edit-picture-btn');
const resetProgressBtn = document.getElementById('reset-progress-btn');
const goProBtn = document.getElementById('go-pro-btn');

// Theme Selector
const themeSelector = document.getElementById('theme-selector');
const themes = ['dark', 'light', 'cyber'];

// General Toggles
const soundToggle = document.getElementById('sound-toggle');

// Accessibility Toggles
const largeTextToggle = document.getElementById('large-text-toggle');
const highContrastToggle = document.getElementById('high-contrast-toggle');
const dyslexiaFontToggle = document.getElementById('dyslexia-font-toggle');
const reduceMotionToggle = document.getElementById('reduce-motion-toggle');

// --- Profile Management ---
function loadProfile() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    displayNameInput.value = profile.name || '';
    profileBioInput.value = profile.bio || '';
    profilePictureImg.src = profile.picture || 'https://avatar.iran.liara.run/public/boy';
}

function saveProfile() {
    const profile = {
        name: displayNameInput.value.trim(),
        bio: profileBioInput.value.trim(),
        picture: profilePictureImg.src
    };
    localStorage.setItem('userProfile', JSON.stringify(profile));
    window.showToast('✅ Profile saved successfully!');
}

async function editProfilePicture() {
    const newUrl = await window.showConfirmationModal({
        title: "Edit Profile Picture",
        text: "Enter a new image URL for your profile picture:",
        confirmText: "Save",
        cancelText: "Cancel",
        isPrompt: true,
        promptValue: profilePictureImg.src
    });

    if (newUrl) { // prompt returns the new value, or null on cancel
        profilePictureImg.src = newUrl;
    }
}

// --- General Settings ---
function loadGeneralSettings() {
    const settings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
    soundToggle.checked = settings.soundEnabled ?? true; // Default to true if not set
}

function handleGeneralSettingsChange(e) {
    const { id, checked } = e.target;
    const settings = JSON.parse(localStorage.getItem('generalSettings') || '{}');

    if (id === 'sound-toggle') {
        settings.soundEnabled = checked;
    }

    localStorage.setItem('generalSettings', JSON.stringify(settings));
}


// --- Accessibility ---
function loadAccessibilitySettings() {
    const settings = JSON.parse(localStorage.getItem('accessibilitySettings') || '{}');
    largeTextToggle.checked = settings.largeText || false;
    highContrastToggle.checked = settings.highContrast || false;
    dyslexiaFontToggle.checked = settings.dyslexiaFont || false;
    reduceMotionToggle.checked = settings.reduceMotion || false;
}

function handleAccessibilityChange(e) {
    const { id, checked } = e.target;
    const settings = JSON.parse(localStorage.getItem('accessibilitySettings') || '{}');
    let bodyClass = '';
    let settingKey = '';

    switch (id) {
        case 'large-text-toggle':
            bodyClass = 'large-text';
            settingKey = 'largeText';
            break;
        case 'high-contrast-toggle':
            bodyClass = 'high-contrast';
            settingKey = 'highContrast';
            break;
        case 'dyslexia-font-toggle':
            bodyClass = 'dyslexia-font';
            settingKey = 'dyslexiaFont';
            break;
        case 'reduce-motion-toggle':
            bodyClass = 'reduce-motion';
            settingKey = 'reduceMotion';
            break;
    }

    if (bodyClass) {
        document.body.classList.toggle(bodyClass, checked);
        settings[settingKey] = checked;
        localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
    }
}


// --- Data Management ---
async function handleResetProgress() {
    const isConfirmed = await window.showConfirmationModal({
        title: "Confirm Data Reset",
        text: "Are you sure you want to reset ALL your progress and profile data? This action cannot be undone.",
        confirmText: "Reset All",
        cancelText: "Cancel"
    });

    if (isConfirmed) {
        progressService.resetProgress();
        localStorage.removeItem('userProfile');
        localStorage.removeItem('accessibilitySettings');
        localStorage.removeItem('generalSettings');
        localStorage.removeItem('selectedTheme');
        // Do not remove onboarding status

        await window.showConfirmationModal({
            title: "Data Reset",
            text: "Your progress and profile have been reset. The page will now reload.",
            confirmText: "OK",
            isAlert: true
        });

        window.location.reload();
    }
}

async function handleGoPro() {
    await window.showConfirmationModal({
        title: "Feature Coming Soon!",
        text: "Pro features are currently in development. Thank you for your interest!",
        confirmText: "Got it!",
        isAlert: true
    });
}

// --- Initialization ---
function init() {
    loadProfile();
    loadGeneralSettings();
    loadAccessibilitySettings();

    // Load and set saved theme for the dropdown selector
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    if (themes.includes(savedTheme)) {
      themeSelector.value = savedTheme;
    } else {
      themeSelector.value = 'light';
    }

    // Add theme change listener
    themeSelector?.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      if (themes.includes(selectedTheme)) {
          // Add class to disable transitions during theme switch for a smoother experience
          document.body.classList.add('theme-transitioning');
          document.documentElement.setAttribute('data-theme', selectedTheme);
          localStorage.setItem('selectedTheme', selectedTheme);
          
          // Remove the class after a short delay to re-enable transitions
          setTimeout(() => {
              document.body.classList.remove('theme-transitioning');
          }, 150);
      }
    });

    saveProfileBtn?.addEventListener('click', saveProfile);
    editPictureBtn?.addEventListener('click', editProfilePicture);
    resetProgressBtn?.addEventListener('click', handleResetProgress);
    goProBtn?.addEventListener('click', handleGoPro);
    
    soundToggle?.addEventListener('change', handleGeneralSettingsChange);
    largeTextToggle?.addEventListener('change', handleAccessibilityChange);
    highContrastToggle?.addEventListener('change', handleAccessibilityChange);
    dyslexiaFontToggle?.addEventListener('change', handleAccessibilityChange);
    reduceMotionToggle?.addEventListener('change', handleAccessibilityChange);
}

init();