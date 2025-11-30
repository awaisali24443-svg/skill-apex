
import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as firebaseService from '../../services/firebaseService.js';

let elements = {};
const animationLevels = ['off', 'subtle', 'full'];

function setActiveThemeButton(button, instant = false) {
    if (!button) return;

    elements.themeToggleButtons.forEach(btn => {
        btn.setAttribute('aria-checked', 'false');
        btn.tabIndex = -1;
    });
    button.setAttribute('aria-checked', 'true');
    button.tabIndex = 0; 

    const indicator = elements.themeToggle.querySelector('.segmented-control-indicator');
    const containerRect = elements.themeToggle.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    
    const left = buttonRect.left - containerRect.left;
    const width = buttonRect.width;
    
    if (instant) indicator.style.transition = 'none';

    indicator.style.left = `${left}px`;
    indicator.style.width = `${width}px`;
    
    if (instant) setTimeout(() => { indicator.style.transition = ''; }, 50);
}

function loadSettings() {
    const config = configService.getConfig();
    elements.soundToggle.checked = config.enableSound;

    const activeThemeButton = elements.themeToggle.querySelector(`button[data-theme="${config.theme}"]`);
    setActiveThemeButton(activeThemeButton, true); 
    
    elements.animationSlider.value = animationLevels.indexOf(config.animationIntensity);
    
    // Set Active Persona
    const currentPersona = config.aiPersona || 'apex';
    elements.personaCards.forEach(card => {
        if (card.dataset.persona === currentPersona) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    const isGuest = firebaseService.isGuest();
    const provider = firebaseService.getUserProvider();

    // Show Email or Guest
    if (elements.emailDisplay) {
        if (isGuest) {
            elements.emailDisplay.textContent = "Guest (Offline Mode)";
            if(elements.guestWarning) elements.guestWarning.style.display = 'block';
            if(elements.logoutBtnText) elements.logoutBtnText.textContent = "Exit Guest Mode";
            if(elements.upgradeSection) elements.upgradeSection.style.display = 'grid';
            if(elements.securitySection) elements.securitySection.style.display = 'none';
        } else {
            elements.emailDisplay.textContent = firebaseService.getUserEmail() || 'Anonymous';
            if(elements.guestWarning) elements.guestWarning.style.display = 'none';
            if(elements.logoutBtnText) elements.logoutBtnText.textContent = "Logout";
            if(elements.upgradeSection) elements.upgradeSection.style.display = 'none';
            
            // Show Security Section ONLY if logged in with password provider
            // Provider is typically 'password' for email login.
            if (elements.securitySection) {
                elements.securitySection.style.display = (provider === 'password') ? 'block' : 'none';
            }
        }
    }
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: elements.soundToggle.checked });
}

function handleAnimationChange() {
    const level = animationLevels[elements.animationSlider.value];
    configService.setConfig({ animationIntensity: level });
}

function handleThemeToggle(event) {
    const button = event.target.closest('button[data-theme]');
    if (button && button.getAttribute('aria-checked') !== 'true') {
        const newTheme = button.dataset.theme;
        setActiveThemeButton(button);
        configService.setConfig({ theme: newTheme });
    }
}

function handleThemeToggleKeydown(event) {
    const { key } = event;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;

    event.preventDefault();

    const buttons = Array.from(elements.themeToggleButtons);
    const checkedButton = elements.themeToggle.querySelector('button[aria-checked="true"]');
    let currentIndex = buttons.indexOf(checkedButton);

    if (key === 'ArrowLeft') {
        currentIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    } else if (key === 'ArrowRight') {
        currentIndex = (currentIndex + 1) % buttons.length;
    }

    const newButton = buttons[currentIndex];
    newButton.focus();
    const newTheme = newButton.dataset.theme;
    setActiveThemeButton(newButton);
    configService.setConfig({ theme: newTheme });
}

function handlePersonaSelect(event) {
    const card = event.target.closest('.persona-card');
    if (!card) return;
    
    const persona = card.dataset.persona;
    
    // Update UI
    elements.personaCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    
    // Save Config
    configService.setConfig({ aiPersona: persona });
    showToast(`Persona updated: ${persona.toUpperCase()}`);
}

async function handleChangeInterest() {
    const confirmed = await showConfirmationModal({
        title: 'Change Learning Field?',
        message: 'This will reset your "Explore Topics" recommendations. Your existing journeys and history will NOT be deleted.',
        confirmText: 'Change Field',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        learningPathService.clearUserInterest();
        showToast('Interest reset. Redirecting to home...', 'success');
        setTimeout(() => {
            window.location.hash = '/';
            window.location.reload();
        }, 1000);
    }
}

async function handleClearData() {
    const confirmed = await showConfirmationModal({
        title: 'Confirm Cache Clear',
        message: 'This will clear data stored on this specific device. Your Cloud data is safe and will be re-synced upon reload. Use this if you are experiencing sync issues.',
        confirmText: 'Clear Cache',
        cancelText: 'Cancel',
        danger: true
    });

    if (confirmed) {
        Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        levelCacheService.clearAllLevels();
        showToast('Local cache cleared.', 'success');
        setTimeout(() => window.location.reload(), 1000);
    }
}

async function handleLogout() {
    const isGuest = firebaseService.isGuest();
    const title = isGuest ? "Exit Guest Mode?" : "Sign Out?";
    const msg = isGuest 
        ? "You will return to the login screen. Your guest progress will remain on this device until cache is cleared."
        : "You will be returned to the login screen. Your data is safely stored in the cloud.";

    const confirmed = await showConfirmationModal({
        title: title,
        message: msg,
        confirmText: isGuest ? 'Exit' : 'Sign Out',
        cancelText: 'Cancel'
    });

    if (confirmed) {
        // Clear local data on logout to prevent data leakage to next user (Unless guest wanting to persist local)
        if (!isGuest) {
             Object.values(LOCAL_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        }
        await firebaseService.logout();
    }
}

function handleInstallClick() {
    const promptEvent = window.deferredInstallPrompt;
    if (!promptEvent) return;
    
    promptEvent.prompt();
    promptEvent.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        }
        window.deferredInstallPrompt = null;
        if(elements.installSection) elements.installSection.style.display = 'none';
    });
}

// --- Account Linking Handlers ---

async function handleLinkGoogle() {
    try {
        await firebaseService.linkGoogle();
        showToast("Account upgraded successfully!", "success");
        loadSettings(); // Refresh UI
    } catch (e) {
        console.error(e);
        let msg = "Failed to link Google account.";
        if (e.code === 'auth/credential-already-in-use') {
            msg = "This Google account is already linked to another user. Sign out to use it.";
        }
        showToast(msg, "error", 5000);
    }
}

function openLinkEmailModal() {
    elements.linkEmailModal.style.display = 'block';
    elements.linkEmailInput.focus();
}

function closeLinkEmailModal() {
    elements.linkEmailModal.style.display = 'none';
    elements.linkError.style.display = 'none';
    elements.linkEmailInput.value = '';
    elements.linkPassInput.value = '';
}

async function handleConfirmLinkEmail() {
    const email = elements.linkEmailInput.value.trim();
    const password = elements.linkPassInput.value.trim();
    
    if (!email || password.length < 6) {
        elements.linkError.textContent = "Invalid email or password (min 6 chars).";
        elements.linkError.style.display = 'block';
        return;
    }
    
    const btn = elements.confirmLinkBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Linking...";
    
    try {
        await firebaseService.linkEmail(email, password);
        showToast("Account upgraded successfully!", "success");
        closeLinkEmailModal();
        loadSettings();
    } catch (e) {
        console.error(e);
        let msg = e.message;
        if (e.code === 'auth/credential-already-in-use') {
            msg = "This email is already registered. Sign out to log in.";
        } else if (e.code === 'auth/invalid-email') {
            msg = "Invalid email format.";
        }
        elements.linkError.textContent = msg;
        elements.linkError.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Password Update Logic ---

function openUpdatePassModal() {
    elements.updatePassModal.style.display = 'block';
    elements.currentPassInput.value = '';
    elements.newPassInput.value = '';
    elements.updatePassError.style.display = 'none';
    elements.currentPassInput.focus();
}

function closeUpdatePassModal() {
    elements.updatePassModal.style.display = 'none';
}

async function handleUpdatePassword() {
    const currentPass = elements.currentPassInput.value;
    const newPass = elements.newPassInput.value;
    
    if (!currentPass) {
        elements.updatePassError.textContent = "Please enter your current password.";
        elements.updatePassError.style.display = 'block';
        return;
    }
    
    if (newPass.length < 6) {
        elements.updatePassError.textContent = "New password must be at least 6 characters.";
        elements.updatePassError.style.display = 'block';
        return;
    }
    
    const btn = elements.confirmUpdatePassBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Updating...";
    
    try {
        // 1. Re-authenticate
        await firebaseService.reauthenticate(currentPass);
        
        // 2. Update Password
        await firebaseService.changePassword(newPass);
        
        showToast("Password updated successfully!", "success");
        closeUpdatePassModal();
        
    } catch (e) {
        console.error(e);
        let msg = "Failed to update password.";
        if (e.code === 'auth/wrong-password') msg = "Current password is incorrect.";
        if (e.code === 'auth/weak-password') msg = "Password is too weak.";
        if (e.code === 'auth/requires-recent-login') msg = "Please sign out and sign in again.";
        
        elements.updatePassError.textContent = msg;
        elements.updatePassError.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

export function init() {
    elements = {
        soundToggle: document.getElementById('sound-toggle'),
        animationSlider: document.getElementById('animation-slider'),
        clearDataBtn: document.getElementById('clear-data-btn'),
        changeInterestBtn: document.getElementById('change-interest-btn'),
        themeToggle: document.getElementById('theme-toggle-group'),
        themeToggleButtons: document.querySelectorAll('#theme-toggle-group button'),
        personaCards: document.querySelectorAll('.persona-card'),
        installSection: document.getElementById('install-app-section'),
        installBtn: document.getElementById('install-app-btn'),
        emailDisplay: document.getElementById('account-email-display'),
        logoutBtn: document.getElementById('logout-btn'),
        logoutBtnText: document.getElementById('logout-btn-text'),
        guestWarning: document.getElementById('guest-warning'),
        
        // Upgrade Elements
        upgradeSection: document.getElementById('upgrade-account-section'),
        linkGoogleBtn: document.getElementById('link-google-btn'),
        linkEmailBtn: document.getElementById('link-email-btn'),
        linkEmailModal: document.getElementById('link-email-modal'),
        linkEmailInput: document.getElementById('link-email-input'),
        linkPassInput: document.getElementById('link-pass-input'),
        cancelLinkBtn: document.getElementById('cancel-link-btn'),
        confirmLinkBtn: document.getElementById('confirm-link-btn'),
        linkError: document.getElementById('link-error'),
        
        // Security Elements
        securitySection: document.getElementById('security-section'),
        changePassBtn: document.getElementById('change-password-btn'),
        updatePassModal: document.getElementById('update-password-modal'),
        currentPassInput: document.getElementById('current-pass-input'),
        newPassInput: document.getElementById('new-pass-input'),
        updatePassError: document.getElementById('update-pass-error'),
        cancelUpdatePassBtn: document.getElementById('cancel-update-pass-btn'),
        confirmUpdatePassBtn: document.getElementById('confirm-update-pass-btn')
    };

    loadSettings();

    elements.soundToggle.addEventListener('change', handleSoundToggle);
    elements.animationSlider.addEventListener('input', handleAnimationChange);
    elements.clearDataBtn.addEventListener('click', handleClearData);
    if (elements.changeInterestBtn) elements.changeInterestBtn.addEventListener('click', handleChangeInterest);
    elements.themeToggle.addEventListener('click', handleThemeToggle);
    elements.themeToggle.addEventListener('keydown', handleThemeToggleKeydown);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Persona Selection
    elements.personaCards.forEach(card => {
        card.addEventListener('click', handlePersonaSelect);
    });

    if (window.deferredInstallPrompt) {
        elements.installSection.style.display = 'block';
        elements.installBtn.addEventListener('click', handleInstallClick);
    }
    
    // Linking Listeners
    if (elements.linkGoogleBtn) elements.linkGoogleBtn.addEventListener('click', handleLinkGoogle);
    if (elements.linkEmailBtn) elements.linkEmailBtn.addEventListener('click', openLinkEmailModal);
    if (elements.cancelLinkBtn) elements.cancelLinkBtn.addEventListener('click', closeLinkEmailModal);
    if (elements.confirmLinkBtn) elements.confirmLinkBtn.addEventListener('click', handleConfirmLinkEmail);
    
    // Password Change Listeners
    if (elements.changePassBtn) elements.changePassBtn.addEventListener('click', openUpdatePassModal);
    if (elements.cancelUpdatePassBtn) elements.cancelUpdatePassBtn.addEventListener('click', closeUpdatePassModal);
    if (elements.confirmUpdatePassBtn) elements.confirmUpdatePassBtn.addEventListener('click', handleUpdatePassword);
}

export function destroy() {
    if (elements.soundToggle) elements.soundToggle.removeEventListener('change', handleSoundToggle);
    if (elements.animationSlider) elements.animationSlider.removeEventListener('input', handleAnimationChange);
    if (elements.clearDataBtn) elements.clearDataBtn.removeEventListener('click', handleClearData);
    if (elements.changeInterestBtn) elements.changeInterestBtn.removeEventListener('click', handleChangeInterest);
    if (elements.themeToggle) {
        elements.themeToggle.removeEventListener('click', handleThemeToggle);
        elements.themeToggle.removeEventListener('keydown', handleThemeToggleKeydown);
    }
    
    if (elements.personaCards) {
        elements.personaCards.forEach(card => card.removeEventListener('click', handlePersonaSelect));
    }

    if (elements.installBtn) elements.installBtn.removeEventListener('click', handleInstallClick);
    if (elements.logoutBtn) elements.logoutBtn.removeEventListener('click', handleLogout);
    
    if (elements.linkGoogleBtn) elements.linkGoogleBtn.removeEventListener('click', handleLinkGoogle);
    if (elements.linkEmailBtn) elements.linkEmailBtn.removeEventListener('click', openLinkEmailModal);
    if (elements.cancelLinkBtn) elements.cancelLinkBtn.removeEventListener('click', closeLinkEmailModal);
    if (elements.confirmLinkBtn) elements.confirmLinkBtn.removeEventListener('click', handleConfirmLinkEmail);
    
    if (elements.changePassBtn) elements.changePassBtn.removeEventListener('click', openUpdatePassModal);
    if (elements.cancelUpdatePassBtn) elements.cancelUpdatePassBtn.removeEventListener('click', closeUpdatePassModal);
    if (elements.confirmUpdatePassBtn) elements.confirmUpdatePassBtn.removeEventListener('click', handleUpdatePassword);
    
    elements = {};
}
