import { onAuthStateChanged, logOut } from '/services/authService.js';
import { getProgress, calculateLevelInfo } from '/services/progressService.js';
import * as quizState from '/services/quizStateService.js';
import { initUIEffects, showWelcomeModal, showToast } from '/services/uiService.js';
import * as C from '/constants.js';

const rootContainer = document.getElementById('root-container');
const headerContainer = document.getElementById('header-container');
const yearSpan = document.getElementById('year');

let currentUser = null;
let isNavigating = false;
let currentModule = {
    name: null,
    cleanup: () => {}
};

// --- Splash Screen Logic ---
function handleSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    if (!splashScreen) return;
    const animationDuration = 4500; 

    const fadeOutSplash = () => {
        if (!splashScreen) return;
        splashScreen.classList.add('fade-out');
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
            document.body.classList.remove('loading-splash');
        }, { once: true });
    };

    window.addEventListener('load', () => {
        setTimeout(fadeOutSplash, animationDuration);
    });
}

// --- Auth State Management ---
onAuthStateChanged(async (user, isNewUser) => {
    currentUser = user;
    await loadHeader();
    await handleRouteChange();
    if (isNewUser) {
        showWelcomeModal();
    }
});

// --- UI & Accessibility ---
function initAccessibility() {
    const settings = JSON.parse(localStorage.getItem(C.ACCESSIBILITY_SETTINGS_KEY) || '{}');
    if (settings.largeText) document.body.classList.add('large-text');
    if (settings.highContrast) document.body.classList.add('high-contrast');
    if (settings.dyslexiaFont) document.body.classList.add('dyslexia-font');
    if (settings.reduceMotion) document.body.classList.add('reduce-motion');
}

// --- Header Stats UI ---
async function updateHeaderStats() {
    if (!currentUser) return;
    const progress = await getProgress();
    if (!progress) return;
    const { level } = calculateLevelInfo(progress.xp);
    const levelEl = document.getElementById('header-level');
    const streakEl = document.getElementById('header-streak');
    
    if (levelEl) levelEl.textContent = `LVL ${level}`;
    if (streakEl) streakEl.textContent = `🔥 ${progress.streak}`;
}
window.updateHeaderStats = updateHeaderStats;


// --- Routing ---
const routes = {
    [C.ROUTE_WELCOME]: { module: 'welcome', auth: false },
    [C.ROUTE_LOGIN]: { module: 'login', auth: false },
    [C.ROUTE_SIGNUP]: { module: 'signup', auth: false },
    [C.ROUTE_HOME]: { module: 'home', auth: true },
    [C.ROUTE_EXPLORE]: { module: 'explore-topics', auth: true },
    [C.ROUTE_CUSTOM_QUIZ]: { module: 'optional-quiz-generator', auth: true },
    [C.ROUTE_CHALLENGE_SETUP]: { module: 'challenge-setup', auth: true },
    [C.ROUTE_CHALLENGE_RESULTS]: { module: 'challenge-results', auth: true },
    [C.ROUTE_LOADING]: { module: 'loading', auth: true },
    [C.ROUTE_QUIZ]: { module: 'quiz', auth: true },
    [C.ROUTE_RESULTS]: { module: 'results', auth: true },
    [C.ROUTE_PROGRESS]: { module: 'screen', auth: true },
    [C.ROUTE_SETTINGS]: { module: 'settings', auth: true },
    [C.ROUTE_STUDY]: { module: 'study', auth: true },
    [C.ROUTE_LEADERBOARD]: { module: 'leaderboard', auth: true },
    [C.ROUTE_LEARNING_PATH]: { module: 'learning-path', auth: true },
};


async function loadModule(moduleName, context = {}) {
    if (!rootContainer || isNavigating || currentModule.name === moduleName) return;
    isNavigating = true;

    // 1. Cleanup previous module
    currentModule.cleanup();
    currentModule = { name: null, cleanup: () => {} };

    // 2. Animate out
    rootContainer.classList.add('module-exit');
    sessionStorage.setItem(C.MODULE_CONTEXT_KEY, JSON.stringify(context));
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        // 3. Fetch and inject new HTML
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module ${moduleName}.html not found.`);
        rootContainer.innerHTML = await response.text();

        // 4. Manage stylesheets
        document.getElementById('module-style')?.remove();
        const style = document.createElement('link');
        style.id = 'module-style';
        style.rel = 'stylesheet';
        style.href = `/modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(style);

        // 5. Animate in
        rootContainer.classList.remove('module-exit');
        rootContainer.classList.add('module-enter');
        
        // 6. Dynamically import and initialize the new module's script
        const module = await import(`/modules/${moduleName}/${moduleName}.js?v=${Date.now()}`);
        
        if (typeof module.init === 'function') {
            await module.init();
        }
        currentModule = {
            name: moduleName,
            cleanup: module.cleanup || (() => {})
        };
        
        // 7. Finalize animation
        setTimeout(() => {
            rootContainer.classList.remove('module-enter');
            isNavigating = false;
        }, 300);

    } catch (error) {
        console.error('Error loading module:', error);
        rootContainer.innerHTML = `<div class="card" style="text-align:center;"><h2 style="color:var(--color-danger);">Error: Could not load page.</h2><p>${error.message}</p></div>`;
        rootContainer.classList.remove('module-exit', 'module-enter');
        isNavigating = false;
    }
}

async function handleRouteChange() {
    let hash = window.location.hash;

    if (hash.startsWith('#challenge=')) {
        if (!currentUser) {
            showToast("You must be logged in to accept a challenge.", "error");
            window.location.hash = C.ROUTE_LOGIN;
            return;
        }
        try {
            const encodedData = hash.substring('#challenge='.length);
            const decodedString = atob(encodedData);
            const { context, quiz } = JSON.parse(decodedString);
            quizState.startNewQuizState(quiz, context);
            window.location.hash = C.ROUTE_QUIZ;
        } catch (error) {
            showToast("Invalid challenge link.", "error");
            window.location.hash = C.ROUTE_HOME;
        }
        return;
    }
    
    if (hash.startsWith('#topics/')) {
        if (!currentUser) {
            showToast("You must be logged in to view topics.", "error");
            window.location.hash = C.ROUTE_LOGIN;
            return;
        }
        const category = hash.substring('#topics/'.length);
        await loadModule('topic-list', { category });
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        return;
    }

    if (!hash) {
        hash = currentUser ? C.ROUTE_HOME : C.ROUTE_WELCOME;
    }

    const route = routes[hash] || routes[currentUser ? C.ROUTE_HOME : C.ROUTE_WELCOME];

    if (route.auth && !currentUser) {
        window.location.hash = C.ROUTE_WELCOME;
        return;
    }
    if (!route.auth && currentUser) {
        window.location.hash = C.ROUTE_HOME;
        return;
    }

    await loadModule(route.module);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === hash);
    });
}

async function handleLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.disabled = true;
    const spinner = logoutBtn.querySelector('.spinner');
    const btnContent = logoutBtn.querySelector('.btn-content');
    spinner?.classList.remove('hidden');
    btnContent?.classList.add('hidden');

    try {
        await logOut();
        window.location.hash = C.ROUTE_LOGIN;
        showToast('You have been logged out.', 'success');
    } catch (error) {
        showToast(`Logout failed: ${error.message}`, 'error');
    }
}

async function loadHeader() {
    try {
        const response = await fetch('/global/header.html');
        if (!response.ok) throw new Error('Header template not found.');
        headerContainer.innerHTML = await response.text();
        
        const userNav = document.getElementById('user-nav');
        const guestNav = document.getElementById('guest-nav');
        const userStats = document.querySelector('.header-user-stats');

        if (currentUser) {
            userNav.classList.remove('hidden');
            guestNav.classList.add('hidden');
            userStats.classList.remove('hidden');
            updateHeaderStats();
            document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        } else {
            userNav.classList.add('hidden');
            guestNav.classList.remove('hidden');
            userStats.classList.add('hidden');
        }
        
        const hamburger = document.querySelector('.nav-hamburger');
        const navLinksContainer = document.querySelector('.nav-links');
        if (hamburger && navLinksContainer) {
            hamburger.addEventListener('click', () => {
                navLinksContainer.classList.toggle('active');
                hamburger.classList.toggle('active');
            });
            document.querySelectorAll('.nav-link, .nav-action-btn').forEach(link => {
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

// --- Initialization ---
function init() {
    handleSplashScreen();
    initUIEffects();
    initAccessibility();
    
    window.addEventListener('hashchange', handleRouteChange);
    
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

document.addEventListener('DOMContentLoaded', init);
