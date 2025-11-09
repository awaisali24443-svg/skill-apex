import { signUp } from '../../services/authService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let form;

const setLoading = (isLoading) => {
    const signupBtn = document.getElementById('signup-btn');
    if (!signupBtn) return;
    const btnText = signupBtn.querySelector('.btn-text');
    const spinner = signupBtn.querySelector('.spinner');
    
    signupBtn.disabled = isLoading;
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

const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    hideError();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (password.length < 8) {
        displayError("Password must be at least 8 characters long.");
        setLoading(false);
        return;
    }

    try {
        await signUp(email, password, username);
        window.showToast('✅ Account created successfully!', 'success');
        // The onAuthStateChanged listener in global.js will handle the redirect
    } catch (error) {
        let userMessage = 'An unknown error occurred.';
        switch(error.code) {
            case 'auth/email-already-in-use': userMessage = 'This email address is already taken.'; break;
            case 'auth/invalid-email': userMessage = 'Please enter a valid email address.'; break;
            case 'auth/weak-password': userMessage = 'Password is too weak. Please choose a stronger one.'; break;
        }
        displayError(userMessage);
    } finally {
        setLoading(false);
    }
};


export function init() {
    sceneManager = initModuleScene('.background-canvas', 'particleGalaxy');
    form = document.getElementById('signup-form');
    if (form) {
        form.addEventListener('submit', handleSignup);
        form.addEventListener('input', hideError);
    }
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    if (form) {
        form.removeEventListener('submit', handleSignup);
        form.removeEventListener('input', hideError);
    }
    form = null;
}
