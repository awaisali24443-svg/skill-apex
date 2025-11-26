
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let elements = {};
let isLoginMode = true;

function toggleMode() {
    isLoginMode = !isLoginMode;
    
    elements.title.textContent = isLoginMode ? 'System Login' : 'New Registration';
    elements.subtitle.textContent = isLoginMode ? 'Identify yourself to access the neural network.' : 'Create a new profile to begin your journey.';
    elements.submitBtnText.textContent = isLoginMode ? 'Connect' : 'Register';
    elements.toggleText.textContent = isLoginMode ? 'New user?' : 'Already have an account?';
    elements.toggleBtn.textContent = isLoginMode ? 'Initialize New Account' : 'Login with Existing ID';
    elements.error.style.display = 'none';
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

function handleError(error) {
    console.error(error);
    let msg = error.message;
    if (msg.includes('invalid-email')) msg = 'Invalid email format.';
    else if (msg.includes('user-not-found')) msg = 'No user found with this email.';
    else if (msg.includes('wrong-password')) msg = 'Incorrect credentials.';
    else if (msg.includes('email-already-in-use')) msg = 'Email already registered.';
    else if (msg.includes('weak-password')) msg = 'Password must be at least 6 characters.';
    else if (msg.includes('popup-closed-by-user')) msg = 'Sign-in cancelled.';
    
    elements.error.textContent = msg;
    elements.error.style.display = 'block';
    
    // Reset Button
    elements.submitBtn.disabled = false;
    elements.submitBtnText.style.display = 'block';
    elements.submitBtnSpinner.style.display = 'none';
}

export function init() {
    const container = document.getElementById('auth-container');
    
    // Fetch HTML manually since this module loads before the router can help
    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            
            // Inject CSS dynamically
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './modules/auth/auth.css';
            document.head.appendChild(link);
            
            // Bind Elements
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
                title: document.getElementById('auth-title'),
                subtitle: document.getElementById('auth-subtitle'),
                toggleText: document.getElementById('auth-toggle-text'),
                error: document.getElementById('auth-error')
            };
            
            elements.form.addEventListener('submit', handleSubmit);
            elements.toggleBtn.addEventListener('click', toggleMode);
            elements.guestBtn.addEventListener('click', handleGuestLogin);
            elements.googleBtn.addEventListener('click', handleGoogleLogin);
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}
