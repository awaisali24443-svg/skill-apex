import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};
let isLoginMode = true;
let resetOobCode = null;

function toggleMode() {
    isLoginMode = !isLoginMode;
    
    if (isLoginMode) {
        if(elements.title) elements.title.innerHTML = 'Welcome Back <span class="wave-emoji">👋</span>';
        if(elements.subtitle) elements.subtitle.textContent = "Today is a new day. It's your day. You shape it. Sign in to start managing your projects.";
        if(elements.submitBtnText) elements.submitBtnText.textContent = 'Sign in';
        if(elements.toggleText) elements.toggleText.textContent = "Don't you have an account?";
        if(elements.toggleBtn) elements.toggleBtn.textContent = 'Sign up';
    } else {
        if(elements.title) elements.title.innerHTML = 'Create Account <span class="wave-emoji">🚀</span>';
        if(elements.subtitle) elements.subtitle.textContent = "Join the Skill Apex network. Forge your path to mastery today.";
        if(elements.submitBtnText) elements.submitBtnText.textContent = 'Sign up';
        if(elements.toggleText) elements.toggleText.textContent = 'Already have an account?';
        if(elements.toggleBtn) elements.toggleBtn.textContent = 'Sign in';
    }

    if(elements.error) elements.error.style.display = 'none';
    if(elements.form) elements.form.reset();
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    
    if (!email || !password) return;
    
    elements.submitBtn.disabled = true;
    elements.submitBtnText.style.display = 'none';
    elements.submitBtnSpinner.style.display = 'block';
    elements.error.style.display = 'none';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
            // Index.js listener handles redirect
        } else {
            await firebaseService.register(email, password);
            showToast('Account created successfully!', 'success');
            // Usually stay logged in, index.js handles redirect
        }
    } catch (error) {
        handleError(error);
    }
}

async function handleGoogleLogin() {
    try {
        await firebaseService.loginWithGoogle();
    } catch (error) {
        handleError(error);
    }
}

async function handleGuestLogin() {
    try {
        await firebaseService.loginAsGuest();
    } catch (error) {
        handleError(error);
    }
}

// ... Reset Password Logic ...
function openResetModal() {
    elements.resetModal.style.display = 'block';
    elements.resetEmailInput.value = elements.emailInput.value; 
    elements.resetEmailInput.focus();
    elements.resetFeedback.textContent = '';
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

    try {
        await firebaseService.resetPassword(email);
        elements.resetFeedback.textContent = `Reset link sent to ${email}. Check your inbox.`;
        elements.resetFeedback.style.color = 'var(--color-success)';
        setTimeout(() => {
            closeResetModal();
            btn.disabled = false;
            btn.textContent = originalText;
        }, 3000);
    } catch (error) {
        let msg = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
        elements.resetFeedback.textContent = msg;
        elements.resetFeedback.style.color = 'var(--color-error)';
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function handleNewPasswordSubmit() {
    if (!resetOobCode) return;
    const newPassword = elements.newPasswordInput.value.trim();
    if (newPassword.length < 6) return;

    const btn = elements.confirmNewPasswordBtn;
    btn.disabled = true;
    btn.textContent = "Updating...";

    try {
        await firebaseService.confirmReset(resetOobCode, newPassword);
        showToast("Password updated! Please sign in.", "success");
        window.history.replaceState({}, document.title, window.location.pathname);
        resetOobCode = null;
        setTimeout(() => {
            elements.newPasswordModal.style.display = 'none';
            elements.passwordInput.focus();
        }, 2000);
    } catch (error) {
        elements.newPasswordFeedback.textContent = "Failed to reset password.";
        btn.disabled = false;
        btn.textContent = "Update";
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
    else if (msg.includes('popup-closed-by-user')) return; // Ignore
    
    elements.error.textContent = msg;
    elements.error.style.display = 'block';
    
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

function checkUrlForReset() {
    const urlParams = new URLSearchParams(window.location.search);
    let mode = urlParams.get('mode');
    let oobCode = urlParams.get('oobCode');

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
        window.history.replaceState({}, document.title, window.location.pathname);
        if (elements.newPasswordModal) {
            elements.newPasswordModal.style.display = 'block';
            elements.newPasswordInput.focus();
        }
    }
}

function renderFallbackAuth() {
    const container = document.getElementById('auth-container');
    container.innerHTML = `
        <div style="background:white; padding:30px; border-radius:16px; width:100%; max-width:400px; margin:auto; text-align:center;">
            <h2 style="margin-bottom:20px; color:#111;">Sign In</h2>
            <form id="auth-form" style="display:flex; flex-direction:column; gap:15px;">
                <input type="email" id="auth-email" placeholder="Email" style="padding:10px; border:1px solid #ccc; border-radius:8px;">
                <input type="password" id="auth-password" placeholder="Password" style="padding:10px; border:1px solid #ccc; border-radius:8px;">
                <button type="submit" id="auth-submit-btn" style="padding:12px; background:#0066ff; color:white; border:none; border-radius:8px; cursor:pointer;">
                    <span class="btn-text">Sign In</span>
                    <div class="spinner" style="display:none;">...</div>
                </button>
            </form>
            <div id="auth-error" style="color:red; margin-top:10px;"></div>
            <div style="margin-top:20px;">
                <button id="guest-login-btn" style="background:none; border:none; color:#555; cursor:pointer; text-decoration:underline;">Continue as Guest</button>
            </div>
        </div>
    `;
    return Promise.resolve();
}

export function init() {
    return new Promise((resolve) => {
        const container = document.getElementById('auth-container');
        
        // Anti-fragile: If fetch fails, render fallback
        fetch('./modules/auth/auth.html')
            .then(res => {
                if (!res.ok) throw new Error("Failed to load auth template");
                return res.text();
            })
            .then(html => {
                container.innerHTML = html;
                
                // Only inject css if not already present
                if (!document.querySelector('link[href="./modules/auth/auth.css"]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = './modules/auth/auth.css';
                    document.head.appendChild(link);
                }
                bindEvents();
                checkUrlForReset();
                resolve();
            })
            .catch(err => {
                console.warn("Using fallback auth UI due to load error:", err);
                renderFallbackAuth().then(() => {
                    bindEvents();
                    resolve();
                });
            });
    });
}

function bindEvents() {
    elements = {
        form: document.getElementById('auth-form'),
        emailInput: document.getElementById('auth-email'),
        passwordInput: document.getElementById('auth-password'),
        submitBtn: document.getElementById('auth-submit-btn'),
        submitBtnText: document.querySelector('#auth-submit-btn .btn-text'),
        submitBtnSpinner: document.querySelector('#auth-submit-btn .spinner'),
        toggleBtn: document.getElementById('auth-toggle-btn'),
        guestBtn: document.getElementById('guest-login-btn'),
        googleBtn: document.getElementById('google-login-btn'),
        forgotBtn: document.getElementById('forgot-password-btn'),
        title: document.getElementById('auth-title'),
        subtitle: document.getElementById('auth-subtitle'),
        toggleText: document.getElementById('auth-toggle-text'),
        error: document.getElementById('auth-error'),
        
        resetModal: document.getElementById('reset-password-modal'),
        resetEmailInput: document.getElementById('reset-email-input'),
        cancelResetBtn: document.getElementById('cancel-reset-btn'),
        confirmResetBtn: document.getElementById('confirm-reset-btn'),
        resetFeedback: document.getElementById('reset-feedback'),

        newPasswordModal: document.getElementById('new-password-modal'),
        newPasswordInput: document.getElementById('new-password-input'),
        confirmNewPasswordBtn: document.getElementById('confirm-new-password-btn'),
        newPasswordFeedback: document.getElementById('new-password-feedback')
    };
    
    if(elements.form) elements.form.addEventListener('submit', handleSubmit);
    if(elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleMode);
    if(elements.guestBtn) elements.guestBtn.addEventListener('click', handleGuestLogin);
    if(elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleLogin);
    
    if (elements.forgotBtn) elements.forgotBtn.addEventListener('click', openResetModal);
    if (elements.cancelResetBtn) elements.cancelResetBtn.addEventListener('click', closeResetModal);
    if (elements.confirmResetBtn) elements.confirmResetBtn.addEventListener('click', handleResetSubmit);
    if (elements.confirmNewPasswordBtn) elements.confirmNewPasswordBtn.addEventListener('click', handleNewPasswordSubmit);
    
    if (elements.resetModal) {
        elements.resetModal.addEventListener('click', (e) => {
            if (e.target === elements.resetModal) closeResetModal();
        });
    }
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}