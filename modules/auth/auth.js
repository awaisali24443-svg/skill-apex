import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

let elements = {};
let isLoginMode = true;

function toggleMode() {
    isLoginMode = !isLoginMode;
    elements.title.textContent = isLoginMode ? 'System Login' : 'New Registration';
    elements.subtitle.textContent = isLoginMode ? 'Identify yourself to access the neural network.' : 'Create a new profile to begin your journey.';
    elements.submitBtnText.textContent = isLoginMode ? 'Connect' : 'Register';
    elements.toggleText.textContent = isLoginMode ? 'Don\'t have an account?' : 'Already have an account?';
    elements.toggleBtn.textContent = isLoginMode ? 'Initialize New Account' : 'Login with Existing ID';
    elements.error.style.display = 'none';
    if (elements.forgotBtn) elements.forgotBtn.style.display = isLoginMode ? 'block' : 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    if (!email || !password) return;
    
    elements.submitBtn.disabled = true;
    elements.submitBtnText.style.display = 'none';
    elements.submitBtnSpinner.style.display = 'block';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
            await firebaseService.syncLocalToCloud();
        } else {
            await firebaseService.register(email, password);
            showToast('Account created successfully!', 'success');
            await firebaseService.syncLocalToCloud();
        }
    } catch (error) {
        handleError(error);
    }
}

// --- FAKE GOOGLE LOGIN THEATRE ---
function showFakeGooglePopup() {
    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.className = 'fake-google-overlay';
        overlay.innerHTML = `
            <div class="fake-google-popup">
                <div class="fg-bar">
                    <div class="fg-logo">
                        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        <span>Sign in with Google</span>
                    </div>
                </div>
                <div class="fg-content">
                    <div class="fg-header">
                        <h2>Choose an account</h2>
                        <p>to continue to <span style="color:#202124; font-weight:500;">Skill Apex</span></p>
                    </div>
                    
                    <div class="fg-list">
                        <div class="fg-item" id="fg-target-account">
                            <div class="fg-avatar">A</div>
                            <div class="fg-text">
                                <div class="fg-name">Admin User</div>
                                <div class="fg-email">admin.expo@skillapex.com</div>
                            </div>
                        </div>
                        <div class="fg-item">
                            <div class="fg-avatar icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="#5f6368"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                            <div class="fg-text">
                                <div class="fg-name">Use another account</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="fg-info-text">
                        To continue, Google will share your name, email address, and language preference with Skill Apex.
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const target = document.getElementById('fg-target-account');
        target.addEventListener('click', () => {
            const popup = overlay.querySelector('.fake-google-popup');
            popup.classList.add('loading');
            popup.innerHTML = `
                <div class="fg-spinner">
                    <svg viewBox="0 0 66 66">
                       <circle class="path" fill="none" stroke-width="6" stroke-linecap="round" cx="33" cy="33" r="30"></circle>
                    </svg>
                </div>
                <p style="font-size:16px; color:#202124;">Signing in...</p>
            `;
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve(true);
            }, 1500);
        });
        
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) {
                document.body.removeChild(overlay);
                reject(new Error("User cancelled Google Login"));
            }
        });
    });
}

async function handleGoogleLogin() {
    try { 
        await showFakeGooglePopup();
        
        // Ensure local slate is clean for the new authenticated session
        await firebaseService.populateGuestData(true); 

        await firebaseService.loginWithGoogle(); 
        await firebaseService.syncLocalToCloud();
        
        showToast("Access Granted via Google Protocol.", "success");
    } catch (error) { 
        if (error.message !== "User cancelled Google Login") {
            handleError({ message: "Google Login failed. Please try again." });
        }
    }
}

async function handleGuestLogin() {
    const btn = document.getElementById('guest-login-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Loading Profile...`;
    btn.disabled = true;

    try {
        // Initialize clean slate for guest
        await firebaseService.populateGuestData(true); 
        await firebaseService.loginAsGuest();
        
        // Delay to allow local storage write to complete before nav
        setTimeout(() => {
            const container = document.getElementById('auth-container');
            if(container) container.style.display = 'none';
            document.getElementById('app-wrapper').style.display = 'flex';
        }, 800);
    } catch (error) {
        handleError(error);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function handleError(error) {
    console.error(error);
    elements.error.textContent = error.message;
    elements.error.style.display = 'block';
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

export function init() {
    const container = document.getElementById('auth-container');
    if (!container) return;

    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            
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
                error: document.getElementById('auth-error')
            };
            
            if(elements.form) elements.form.addEventListener('submit', handleSubmit);
            if(elements.toggleBtn) elements.toggleBtn.addEventListener('click', toggleMode);
            if(elements.googleBtn) elements.googleBtn.addEventListener('click', handleGoogleLogin);
            if(elements.guestBtn) elements.guestBtn.addEventListener('click', handleGuestLogin);
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}