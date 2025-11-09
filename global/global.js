/*
    GLOBAL SCRIPT
    This file handles routing and loading shared components.
*/
import { playSound } from '/services/soundService.js';

const rootContainer = document.getElementById('root-container');
const headerContainer = document.getElementById('header-container');
const yearSpan = document.getElementById('year');

// --- UI Effects ---

function initCursorAura() {
    const aura = document.getElementById('cursor-aura');
    if (!aura) return;
    document.addEventListener('mousemove', e => {
        aura.style.transform = `translate(${e.clientX - 15}px, ${e.clientY - 15}px)`;
    });
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// Make toast globally available
window.showToast = showToast;

function initGlobalSounds() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('button, a.btn, .feature-card, .topic-card, .theme-option, .nav-link, .quick-action-card, .toggle-switch')) {
            playSound('click');
        }
    });
}

function initOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    const skipBtn = document.getElementById('onboarding-skip-btn');
    if (!overlay || !skipBtn) return;

    const hasOnboarded = localStorage.getItem('knowledgeTesterOnboarded');
    if (!hasOnboarded) {
        overlay.classList.remove('hidden');
    }

    skipBtn.addEventListener('click', () => {
        overlay.classList.add('hidden');
        localStorage.setItem('knowledgeTesterOnboarded', 'true');
    });
}

function initAccessibility() {
    const settings = JSON.parse(localStorage.getItem('accessibilitySettings') || '{}');
    if (settings.largeText) document.body.classList.add('large-text');
    if (settings.highContrast) document.body.classList.add('high-contrast');
    if (settings.dyslexiaFont) document.body.classList.add('dyslexia-font');
    if (settings.reduceMotion) document.body.classList.add('reduce-motion');
}

// --- Confirmation Modal ---
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalInputContainer = document.getElementById('modal-input-container');
const modalInput = document.getElementById('modal-input');

function showConfirmationModal({
    title,
    text,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isAlert = false,
    isPrompt = false,
    promptValue = ''
}) {
    return new Promise((resolve) => {
        if (!modalContainer || !modalTitle || !modalText || !modalConfirmBtn || !modalCancelBtn || !modalInputContainer || !modalInput) {
            console.error("Modal elements not found!");
            resolve(isPrompt ? null : false);
            return;
        }

        modalTitle.textContent = title;
        modalText.textContent = text;
        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;

        if (isAlert) {
            modalCancelBtn.classList.add('hidden');
            modalConfirmBtn.className = 'btn btn-primary';
        } else {
            modalCancelBtn.classList.remove('hidden');
            modalConfirmBtn.className = isPrompt ? 'btn btn-primary' : 'btn btn-danger';
        }

        if (isPrompt) {
            modalInputContainer.classList.remove('hidden');
            modalInput.value = promptValue;
        } else {
            modalInputContainer.classList.add('hidden');
        }

        modalContainer.classList.remove('hidden');

        let confirmHandler, cancelHandler, keydownHandler;

        const cleanup = (value) => {
            modalContainer.classList.add('hidden');
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            document.removeEventListener('keydown', keydownHandler);

            if (isPrompt) {
                resolve(value ? modalInput.value : null);
            } else {
                resolve(value);
            }
        };

        confirmHandler = () => cleanup(true);
        cancelHandler = () => cleanup(false);
        keydownHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmHandler();
            } else if (e.key === 'Escape') {
                cancelHandler();
            }
        };

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
        document.addEventListener('keydown', keydownHandler);

        if (isPrompt) {
            setTimeout(() => modalInput.focus(), 50);
        }
    });
}
window.showConfirmationModal = showConfirmationModal;


// --- Routing ---

const staticRoutes = {
    '': 'welcome', // Default route
    '#welcome': 'welcome',
    '#login': 'login',
    '#signup': 'signup',
    '#home': 'home',
    '#explore-topics': 'explore-topics',
    '#optional-quiz': 'optional-quiz-generator',
    '#loading': 'loading',
    '#quiz': 'quiz',
    '#results': 'results',
    '#screen': 'screen',
    '#settings': 'settings'
};

let isNavigating = false;

async function loadModule(moduleName, context = {}) {
    if (!rootContainer || isNavigating) return;
    isNavigating = true;

    rootContainer.classList.add('module-exit');
    
    // Pass context to the next module
    sessionStorage.setItem('moduleContext', JSON.stringify(context));
    
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module ${moduleName}.html not found.`);
        
        const html = await response.text();
        rootContainer.innerHTML = html;
        rootContainer.classList.remove('module-exit');
        rootContainer.classList.add('module-enter');

        document.getElementById('module-style')?.remove();
        document.getElementById('module-script')?.remove();

        const style = document.createElement('link');
        style.id = 'module-style';
        style.rel = 'stylesheet';
        style.href = `/modules/${moduleName}/${moduleName}.css`;
        
        style.onload = () => {
             setTimeout(() => {
                rootContainer.classList.remove('module-enter');
                isNavigating = false;
            }, 300);
        };
        style.onerror = () => {
            console.error(`Failed to load stylesheet for ${moduleName}.`);
            rootContainer.classList.remove('module-enter');
            isNavigating = false;
        };
        
        document.head.appendChild(style);

        const script = document.createElement('script');
        script.id = 'module-script';
        script.type = 'module';
        script.src = `/modules/${moduleName}/${moduleName}.js`;
        document.body.appendChild(script);

    } catch (error) {
        console.error('Error loading module:', error);
        rootContainer.innerHTML = `<div class="card" style="text-align:center;"><h2 style="color:var(--color-danger);">Error: Could not load page.</h2><p>${error.message}</p></div>`;
        rootContainer.classList.remove('module-exit', 'module-enter');
        isNavigating = false;
    }
}

function handleRouteChange() {
    const hash = window.location.hash || '#welcome';

    // Handle dynamic routes first
    if (hash.startsWith('#topics/')) {
        const category = hash.split('/')[1];
        loadModule('topic-list', { category });
    } else {
        // Handle static routes
        const moduleName = staticRoutes[hash] || 'welcome';
        loadModule(moduleName);
    }

    // Update active nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === hash);
    });
}

async function loadHeader() {
    try {
        const response = await fetch('/global/header.html');
        if (!response.ok) throw new Error('Header template not found.');
        headerContainer.innerHTML = await response.text();
        
        // Init navbar logic
        const hamburger = document.querySelector('.nav-hamburger');
        const navLinksContainer = document.querySelector('.nav-links');
        if (hamburger && navLinksContainer) {
            hamburger.addEventListener('click', () => {
                navLinksContainer.classList.toggle('active');
                hamburger.classList.toggle('active');
            });

            // Close mobile nav on link click
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    navLinksContainer.classList.remove('active');
                    hamburger.classList.remove('active');
                });
            });
        }
    } catch (error) {
        console.error('Error loading header:', error);
        headerContainer.innerHTML = '<p style="color:red; text-align:center;">Error loading header</p>';
    }
}

function init() {
    loadHeader();
    initCursorAura();
    initGlobalSounds();
    initOnboarding();
    initAccessibility();
    
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Initial load
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Register Service Worker for PWA capabilities
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

init();