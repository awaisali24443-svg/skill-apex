
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};
let isLoginMode = true;
let resetOobCode = null;

function toggleMode() {
    isLoginMode = !isLoginMode;
    
    elements.title.textContent = isLoginMode ? 'System Login' : 'New Registration';
    elements.subtitle.textContent = isLoginMode ? 'Identify yourself to access the neural network.' : 'Create a new profile to begin your journey.';
    elements.submitBtnText.textContent = isLoginMode ? 'Connect' : 'Register';
    elements.toggleText.textContent = isLoginMode ? 'New user?' : 'Already have an account?';
    elements.toggleBtn.textContent = isLoginMode ? 'Initialize New Account' : 'Login with Existing ID';
    elements.error.style.display = 'none';
    
    // Hide forgot button in register mode
    if (elements.forgotBtn) elements.forgotBtn.style.display = isLoginMode ? 'block' : 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    
    if (!email || !password) return;
    
    // UI Loading State
    elements.submitBtn.disabled = true;
    elements.submitBtnText.style.display = 'none';
    elements.submitBtnSpinner.style.display = 'block';
    elements.error.style.display = 'none';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
            // Auth state change listener in index.js will handle the redirect
        } else {
            await firebaseService.register(email, password);
            showToast('Account created successfully!', 'success');
        }
    } catch (error) {
        handleError(error);
    }
}

async function handleGoogleLogin() {
    try {
        await firebaseService.loginWithGoogle();
        // Auth listener handles redirect
    } catch (error) {
        handleError(error);
    }
}

async function handleGuestLogin() {
    try {
        await firebaseService.loginAsGuest();
        // Auth listener handles redirect
    } catch (error) {
        handleError(error);
    }
}

// --- Reset Password Logic (Request Link) ---
function openResetModal() {
    elements.resetModal.style.display = 'block';
    elements.resetEmailInput.value = elements.emailInput.value; // Pre-fill if available
    elements.resetEmailInput.focus();
    elements.resetFeedback.style.display = 'none';
}

function closeResetModal() {
    elements.resetModal.style.display = 'none';
}

async function handleResetSubmit() {
    const email = elements.resetEmailInput.value.trim();
    if (!email) return;

    const btn = elements.confirmResetBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";
    elements.resetFeedback.style.display = 'none';

    try {
        // This now uses custom settings to redirect back to the app
        await firebaseService.resetPassword(email);
        elements.resetFeedback.textContent = `Reset link sent to ${email}. Check your inbox.`;
        elements.resetFeedback.style.color = 'var(--color-success)';
        elements.resetFeedback.style.backgroundColor = 'var(--color-success-bg)';
        elements.resetFeedback.style.display = 'block';
        
        setTimeout(() => {
            closeResetModal();
            btn.disabled = false;
            btn.textContent = originalText;
        }, 3000);
    } catch (error) {
        console.error("Reset Password Error:", error);
        let msg = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
        if (error.code === 'auth/invalid-email') msg = "Invalid email address.";
        
        elements.resetFeedback.textContent = msg;
        elements.resetFeedback.style.color = 'var(--color-error)';
        elements.resetFeedback.style.backgroundColor = 'var(--color-error-bg)';
        elements.resetFeedback.style.display = 'block';
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Confirm New Password Logic (From Email Link) ---
async function handleNewPasswordSubmit() {
    if (!resetOobCode) return;
    
    const newPassword = elements.newPasswordInput.value.trim();
    if (newPassword.length < 6) {
        elements.newPasswordFeedback.textContent = "Password must be at least 6 characters.";
        elements.newPasswordFeedback.style.color = 'var(--color-error)';
        elements.newPasswordFeedback.style.backgroundColor = 'var(--color-error-bg)';
        elements.newPasswordFeedback.style.display = 'block';
        return;
    }

    const btn = elements.confirmNewPasswordBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Updating...";
    elements.newPasswordFeedback.style.display = 'none';

    try {
        await firebaseService.confirmReset(resetOobCode, newPassword);
        
        elements.newPasswordFeedback.textContent = "Password updated successfully! Logging you in...";
        elements.newPasswordFeedback.style.color = 'var(--color-success)';
        elements.newPasswordFeedback.style.backgroundColor = 'var(--color-success-bg)';
        elements.newPasswordFeedback.style.display = 'block';
        
        showToast("Password updated! Please sign in.", "success");
        
        // Clear params to prevent re-triggering
        window.history.replaceState({}, document.title, window.location.pathname);
        resetOobCode = null;

        setTimeout(() => {
            elements.newPasswordModal.style.display = 'none';
            // Auto-fill login email if possible? Hard to know email here without asking.
            // Just focus login
            elements.passwordInput.focus();
        }, 2000);

    } catch (error) {
        console.error("Confirm Password Error:", error);
        let msg = "Failed to reset password. Link may be expired.";
        if (error.code === 'auth/expired-action-code') msg = "This link has expired. Please request a new one.";
        if (error.code === 'auth/invalid-action-code') msg = "Invalid link. Please request a new one.";
        
        elements.newPasswordFeedback.textContent = msg;
        elements.newPasswordFeedback.style.color = 'var(--color-error)';
        elements.newPasswordFeedback.style.backgroundColor = 'var(--color-error-bg)';
        elements.newPasswordFeedback.style.display = 'block';
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function handleError(error) {
    console.error(error);
    let msg = error.message;
    if (msg.includes('invalid-email')) msg = 'Invalid email format.';
    else if (msg.includes('user-not-found')) msg = 'No user found with this email.';
    else if (msg.includes('wrong-password')) msg = 'Incorrect credentials.';
    else if (msg.includes('email-already-in-use')) msg = 'Email already registered.';
    else if (msg.includes('weak-password')) msg = 'Password must be at least 6 characters.';
    else if (msg.includes('popup-closed-by-user')) msg = 'Sign-in cancelled.';
    else if (msg.includes('too-many-requests')) msg = 'Too many attempts. Try again later.';
    
    elements.error.textContent = msg;
    elements.error.style.display = 'block';
    
    // Reset Button
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

function checkUrlForReset() {
    // Check both standard query params and hash-based params (depending on router behavior)
    const urlParams = new URLSearchParams(window.location.search);
    let mode = urlParams.get('mode');
    let oobCode = urlParams.get('oobCode');

    // Fallback: Check hash if router moves params there
    if (!mode || !oobCode) {
        const hashParts = window.location.hash.split('?');
        if (hashParts.length > 1) {
            const hashParams = new URLSearchParams(hashParts[1]);
            if (!mode) mode = hashParams.get('mode');
            if (!oobCode) oobCode = hashParams.get('oobCode');
        }
    }

    if (mode === 'resetPassword' && oobCode) {
        resetOobCode = oobCode;
        console.log("Password Reset Mode Detected.");
        
        // Clean URL visually to hide codes/keys immediately
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show Modal
        if (elements.newPasswordModal) {
            elements.newPasswordModal.style.display = 'block';
            elements.newPasswordInput.focus();
        }
    }
}

export function init() {
    const container = document.getElementById('auth-container');
    
    // Fetch HTML manually since this module loads before the router can help
    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            
            // Inject CSS dynamically (Only if not already present)
            if (!document.querySelector('link[href="./modules/auth/auth.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = './modules/auth/auth.css';
                document.head.appendChild(link);
            }
            
            // Bind Elements
            elements = {
                form: document.getElementById('auth-form'),
                emailInput: document.getElementById('auth-email'),
                passwordInput: document.getElementById('auth-password'),
                submitBtn: document.getElementById('auth-submit-btn'),
                submitBtnText: document.querySelector('#auth-submit-btn .btn-text'),
                submitBtnSpinner: document.querySelector('#auth-submit-btn .spinner'),
                toggleBtn: document.getElementById('auth-toggle-btn'),
                googleBtn: document.getElementById('google-login-btn'),
                guestBtn: document.getElementById('guest-login-btn'),
                forgotBtn: document.getElementById('forgot-password-btn'),
                title: document.getElementById('auth-title'),
                subtitle: document.getElementById('auth-subtitle'),
                toggleText: document.getElementById('auth-toggle-text'),
                error: document.getElementById('auth-error'),
                
                // Reset Modal Elements
                resetModal: document.getElementById('reset-password-modal'),
                resetEmailInput: document.getElementById('reset-email-input'),
                cancelResetBtn: document.getElementById('cancel-reset-btn'),
                confirmResetBtn: document.getElementById('confirm-reset-btn'),
                resetFeedback: document.getElementById('reset-feedback'),

                // New Password Modal Elements
                newPasswordModal: document.getElementById('new-password-modal'),
                newPasswordInput: document.getElementById('new-password-input'),
                confirmNewPasswordBtn: document.getElementById('confirm-new-password-btn'),
                newPasswordFeedback: document.getElementById('new-password-feedback')
            };
            
            if(elements.form) elements.form.addEventListener('submit', handleSubmit);
            if(elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleMode);
            if(elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleLogin);
            if(elements.guestBtn) elements.guestBtn.addEventListener('click', handleGuestLogin);
            
            if (elements.forgotBtn) elements.forgotBtn.addEventListener('click', openResetModal);
            if (elements.cancelResetBtn) elements.cancelResetBtn.addEventListener('click', closeResetModal);
            if (elements.confirmResetBtn) elements.confirmResetBtn.addEventListener('click', handleResetSubmit);
            if (elements.confirmNewPasswordBtn) elements.confirmNewPasswordBtn.addEventListener('click', handleNewPasswordSubmit);
            
            // Close modal on backdrop click
            if (elements.resetModal) {
                elements.resetModal.addEventListener('click', (e) => {
                    if (e.target === elements.resetModal) closeResetModal();
                });
            }

            // Check if we arrived here via a reset email link
            checkUrlForReset();
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}
