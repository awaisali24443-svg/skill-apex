
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';
import { LOCAL_STORAGE_KEYS } from '../../constants.js';

let elements = {};
let isLoginMode = true;

function toggleMode() {
    isLoginMode = !isLoginMode;
    const title = isLoginMode ? 'Access Terminal' : 'New User Registration';
    const sub = isLoginMode ? 'Authenticate to synchronize progress.' : 'Create a profile to begin data tracking.';
    const btn = isLoginMode ? 'Connect' : 'Register';
    const toggle = isLoginMode ? 'Initialize New Account' : 'Return to Login';
    
    document.getElementById('auth-title').textContent = title;
    document.getElementById('auth-subtitle').textContent = sub;
    document.querySelector('#auth-submit-btn .btn-text').textContent = btn;
    document.getElementById('auth-toggle-btn').textContent = toggle;
    document.getElementById('auth-error').style.display = 'none';
}

// --- DEMO QUIZ LOGIC (Frontend Only) ---
function initDemoQuiz() {
    const options = document.querySelectorAll('#demo-options .option-btn');
    const feedback = document.getElementById('demo-feedback');
    
    options.forEach(btn => {
        btn.addEventListener('click', () => {
            // Reset
            options.forEach(b => b.className = 'btn option-btn');
            
            const isCorrect = btn.dataset.correct === 'true';
            if (isCorrect) {
                btn.classList.add('correct');
                feedback.textContent = "CORRECT: The CPU executes instructions.";
                feedback.style.color = "var(--color-success)";
            } else {
                btn.classList.add('incorrect');
                feedback.textContent = "INCORRECT: Try accessing the CPU node.";
                feedback.style.color = "var(--color-error)";
            }
        });
    });
}

// --- AUTH HANDLERS ---

async function handleSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!email || !password) return;
    
    const btn = document.getElementById('auth-submit-btn');
    const spinner = btn.querySelector('.spinner');
    const text = btn.querySelector('.btn-text');
    
    btn.disabled = true;
    text.style.display = 'none';
    spinner.style.display = 'block';
    
    try {
        if (isLoginMode) {
            await firebaseService.login(email, password);
        } else {
            await firebaseService.register(email, password);
            showToast('Profile initialized.', 'success');
        }
    } catch (error) {
        handleError(error);
    }
}

async function handleGoogleLogin() {
    try { await firebaseService.loginWithGoogle(); } catch (error) { handleError(error); }
}

async function handleGuestLogin() {
    try {
        await firebaseService.loginAsGuest();
    } catch (error) {
        console.warn("Offline Mode Engaged");
        firebaseService.enableSimulationMode();
    }
}

function handleError(error) {
    console.error(error);
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');
    
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'block';
    btn.querySelector('.spinner').style.display = 'none';
}

// --- SCROLL HANDLERS ---
function scrollToAuth() {
    document.getElementById('auth-section').scrollIntoView({ behavior: 'smooth' });
}

function scrollToDemo() {
    document.getElementById('demo-section').scrollIntoView({ behavior: 'smooth' });
}

export function init() {
    const container = document.getElementById('auth-container');
    
    fetch('./modules/auth/auth.html')
        .then(res => res.text())
        .then(html => {
            container.innerHTML = html;
            
            // Dynamic CSS Load
            if (!document.querySelector('link[href="./modules/auth/auth.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = './modules/auth/auth.css';
                document.head.appendChild(link);
            }
            
            // Attach Listeners
            document.getElementById('auth-form')?.addEventListener('submit', handleSubmit);
            document.getElementById('auth-toggle-btn')?.addEventListener('click', toggleMode);
            document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
            document.getElementById('guest-login-btn')?.addEventListener('click', handleGuestLogin);
            
            // Landing Page Specifics
            document.getElementById('hero-cta-btn')?.addEventListener('click', scrollToAuth);
            document.getElementById('nav-login-btn')?.addEventListener('click', scrollToAuth);
            document.getElementById('hero-demo-btn')?.addEventListener('click', scrollToDemo);
            
            initDemoQuiz();
        });
}

export function destroy() {
    const container = document.getElementById('auth-container');
    if (container) container.innerHTML = '';
}
