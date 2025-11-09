import { logIn } from '../../services/authService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let form;

const setLoading = (isLoading) => {
    const loginBtn = document.getElementById('login-btn');
    if (!loginBtn) return;
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner');
    
    loginBtn.disabled = isLoading;
    btnText.classList.toggle('hidden', isLoading);
    spinner.classList.toggle('hidden', !isLoading);
};

const displayError = (message) => {
    const errorMessageDiv = document.getElementById('error-message');
    if (!errorMessageDiv) return;
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('hidden');
};

const hideError = () => {
    const errorMessageDiv = document.getElementById('error-message');
    if (errorMessageDiv && !errorMessageDiv.classList.contains('hidden')) {
        errorMessageDiv.classList.add('hidden');
    }
};

const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    hideError();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await logIn(email, password);
        window.showToast('✅ Login successful!', 'success');
        // The onAuthStateChanged listener in global.js will handle the redirect
    } catch (error) {
        let userMessage = 'An unknown error occurred.';
        switch(error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                userMessage = 'Invalid email or password.';
                break;
            case 'auth/invalid-email':
                userMessage = 'Please enter a valid email address.';
                break;
        }
        displayError(userMessage);
    } finally {
        setLoading(false);
    }
};

export function init() {
    sceneManager = initModuleScene('.background-canvas', 'particleGalaxy');
    form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
        form.addEventListener('input', hideError);
    }
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    if (form) {
        form.removeEventListener('submit', handleLogin);
        form.removeEventListener('input', hideError);
    }
    form = null;
}
