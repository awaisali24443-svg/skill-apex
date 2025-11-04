import * as progressService from '../../services/progressService.js';

console.log("Settings/Profile module loaded.");

// --- DOM Elements ---
const displayNameInput = document.getElementById('display-name');
const profileBioInput = document.getElementById('profile-bio');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profilePictureImg = document.getElementById('profile-picture');
const editPictureBtn = document.getElementById('edit-picture-btn');
const resetProgressBtn = document.getElementById('reset-progress-btn');

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

function editProfilePicture() {
    const newUrl = prompt("Enter a new image URL for your profile picture:", profilePictureImg.src);
    if (newUrl) {
        profilePictureImg.src = newUrl;
    }
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
function handleResetProgress() {
    const isConfirmed = window.confirm("Are you sure you want to reset ALL your progress and profile data? This action cannot be undone.");
    if (isConfirmed) {
        progressService.resetProgress();
        localStorage.removeItem('userProfile');
        localStorage.removeItem('accessibilitySettings');
        // Do not remove onboarding status
        alert("Your progress and profile have been reset. The page will now reload.");
        window.location.reload();
    }
}

// --- Initialization ---
function init() {
    loadProfile();
    loadAccessibilitySettings();

    saveProfileBtn?.addEventListener('click', saveProfile);
    editPictureBtn?.addEventListener('click', editProfilePicture);
    resetProgressBtn?.addEventListener('click', handleResetProgress);
    
    largeTextToggle?.addEventListener('change', handleAccessibilityChange);
    highContrastToggle?.addEventListener('change', handleAccessibilityChange);
    dyslexiaFontToggle?.addEventListener('change', handleAccessibilityChange);
    reduceMotionToggle?.addEventListener('change', handleAccessibilityChange);
}

init();