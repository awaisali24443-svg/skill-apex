
import * as configService from '../../services/configService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';
import { showToast } from '../../services/toastService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as firebaseService from '../../services/firebaseService.js';
import * as apiService from '../../services/apiService.js';

let elements = {};
const animationLevels = ['off', 'subtle', 'full'];

function loadSettings() {
    const config = configService.getConfig();
    elements.soundToggle.checked = config.enableSound;
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
    
    // Set Active Theme State
    updateThemeUI(config.theme);

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
            if (elements.securitySection) {
                elements.securitySection.style.display = (provider === 'password') ? 'block' : 'none';
            }
        }
    }
}

function updateThemeUI(currentTheme) {
    const indicator = document.querySelector('.segmented-control-indicator');
    const lightBtn = document.getElementById('theme-light-btn');
    const darkBtn = document.getElementById('theme-dark-btn');
    
    if (!indicator || !lightBtn || !darkBtn) return;

    // Default to light if unknown
    const isDark = currentTheme === 'dark-cyber';
    
    if (isDark) {
        darkBtn.setAttribute('aria-pressed', 'true');
        lightBtn.setAttribute('aria-pressed', 'false');
        // Move indicator to the right
        indicator.style.left = '50%';
        indicator.style.width = '50%';
    } else {
        lightBtn.setAttribute('aria-pressed', 'true');
        darkBtn.setAttribute('aria-pressed', 'false');
        // Move indicator to the left
        indicator.style.left = '4px'; // 4px padding in css
        indicator.style.width = 'calc(50% - 4px)';
    }
}

function handleThemeChange(event) {
    const btn = event.target.closest('.theme-btn');
    if (!btn) return;
    
    const theme = btn.dataset.theme;
    configService.setConfig({ theme: theme });
    updateThemeUI(theme);
}

function handleSoundToggle() {
    configService.setConfig({ enableSound: elements.soundToggle.checked });
}

function handleAnimationChange() {
    const level = animationLevels[elements.animationSlider.value];
    configService.setConfig({ animationIntensity: level });
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
        window.location.reload(); // Force refresh to ensure clean state
    }
}

async function handleTestConnection() {
    const btn = document.getElementById('test-connection-btn');
    if (!btn) return;
    
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></div> Pinging Core...`;
    
    try {
        const result = await apiService.checkSystemStatus();
        
        if (result.status === 'online') {
            btn.innerHTML = `<svg class="icon" style="color:white;"><use href="assets/icons/feather-sprite.svg#check-circle"/></svg> <span style="color:white">ONLINE (${result.latency}ms)</span>`;
            btn.style.backgroundColor = 'var(--color-success)';
            btn.style.borderColor = 'var(--color-success)';
            showToast(`System Nominal. Latency: ${result.latency}ms`, 'success');
        } else if (result.status === 'offline') {
            const errorMsg = result.message || 'AI Unreachable';
            btn.innerHTML = `<svg class="icon" style="color:white;"><use href="assets/icons/feather-sprite.svg#x-circle"/></svg> <span style="color:white">${errorMsg.substring(0, 15)}...</span>`;
            btn.style.backgroundColor = '#f59e0b'; // Warning Orange
            btn.style.borderColor = '#f59e0b';
            showToast(`Error: ${result.message}`, 'error', 5000); // Long duration for reading
        } else {
            throw new Error(result.message);
        }
    } catch (e) {
        btn.innerHTML = `<svg class="icon" style="color:white;"><use href="assets/icons/feather-sprite.svg#x-circle"/></svg> <span style="color:white">NET ERROR</span>`;
        btn.style.backgroundColor = 'var(--color-error)';
        btn.style.borderColor = 'var(--color-error)';
        showToast('Connection Failed: Network unreachable.', 'error');
    }
    
    // Reset after 5 seconds to let them read error
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
        btn.disabled = false;
    }, 5000);
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
        personaCards: document.querySelectorAll('.persona-card'),
        installSection: document.getElementById('install-app-section'),
        installBtn: document.getElementById('install-app-btn'),
        emailDisplay: document.getElementById('account-email-display'),
        logoutBtn: document.getElementById('logout-btn'),
        logoutBtnText: document.getElementById('logout-btn-text'),
        guestWarning: document.getElementById('guest-warning'),
        
        // Theme Buttons
        themeLightBtn: document.getElementById('theme-light-btn'),
        themeDarkBtn: document.getElementById('theme-dark-btn'),
        
        // Diagnostics
        testConnectionBtn: document.getElementById('test-connection-btn'),
        
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

    if (elements.themeLightBtn) elements.themeLightBtn.addEventListener('click', handleThemeChange);
    if (elements.themeDarkBtn) elements.themeDarkBtn.addEventListener('click', handleThemeChange);

    if (elements.soundToggle) elements.soundToggle.addEventListener('change', handleSoundToggle);
    if (elements.animationSlider) elements.animationSlider.addEventListener('input', handleAnimationChange);
    if (elements.clearDataBtn) elements.clearDataBtn.addEventListener('click', handleClearData);
    if (elements.changeInterestBtn) elements.changeInterestBtn.addEventListener('click', handleChangeInterest);
    
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', handleLogout);
    
    if (elements.testConnectionBtn) elements.testConnectionBtn.addEventListener('click', handleTestConnection);
    
    // Persona Selection
    elements.personaCards.forEach(card => {
        card.addEventListener('click', handlePersonaSelect);
    });

    if (window.deferredInstallPrompt && elements.installSection) {
        elements.installSection.style.display = 'block';
        if (elements.installBtn) elements.installBtn.addEventListener('click', handleInstallClick);
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
    if (elements.themeLightBtn) elements.themeLightBtn.removeEventListener('click', handleThemeChange);
    if (elements.themeDarkBtn) elements.themeDarkBtn.removeEventListener('click', handleThemeChange);

    if (elements.soundToggle) elements.soundToggle.removeEventListener('change', handleSoundToggle);
    if (elements.animationSlider) elements.animationSlider.removeEventListener('input', handleAnimationChange);
    if (elements.clearDataBtn) elements.clearDataBtn.removeEventListener('click', handleClearData);
    if (elements.changeInterestBtn) elements.changeInterestBtn.removeEventListener('click', handleChangeInterest);
    
    if (elements.personaCards) {
        elements.personaCards.forEach(card => card.removeEventListener('click', handlePersonaSelect));
    }

    if (elements.installBtn) elements.installBtn.removeEventListener('click', handleInstallClick);
    if (elements.logoutBtn) elements.logoutBtn.removeEventListener('click', handleLogout);
    
    if (elements.testConnectionBtn) elements.testConnectionBtn.removeEventListener('click', handleTestConnection);
    
    if (elements.linkGoogleBtn) elements.linkGoogleBtn.removeEventListener('click', handleLinkGoogle);
    if (elements.linkEmailBtn) elements.linkEmailBtn.removeEventListener('click', openLinkEmailModal);
    if (elements.cancelLinkBtn) elements.cancelLinkBtn.removeEventListener('click', closeLinkEmailModal);
    if (elements.confirmLinkBtn) elements.confirmLinkBtn.removeEventListener('click', handleConfirmLinkEmail);
    
    if (elements.changePassBtn) elements.changePassBtn.removeEventListener('click', openUpdatePassModal);
    if (elements.cancelUpdatePassBtn) elements.cancelUpdatePassBtn.removeEventListener('click', closeUpdatePassModal);
    if (elements.confirmUpdatePassBtn) elements.confirmUpdatePassBtn.removeEventListener('click', handleUpdatePassword);
    
    elements = {};
}
