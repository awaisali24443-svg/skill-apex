// global/global.js

// --- CORE IMPORTS ---
import { ROUTES, MODULE_CONTEXT_KEY } from '../constants.js';
import * as authService from '../services/authService.js';
import * as progressService from '../services/progressService.js';
import { initUIEffects, showToast, showWelcomeModal } from '../services/uiService.js';

// --- STATE ---
let currentModule = null;
let currentUser = null;
let userProgress = null;
let headerHTMLTemplate = ''; // Cache for the header template

// --- SPLASH SCREEN MANAGEMENT ---
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('fade-out');
        document.body.classList.remove('loading-splash');
    }
}

// --- HEADER MANAGEMENT ---
async function updateHeaderUI(user, progress) {
    const headerContainer = document.getElementById('header-container');
    if (!headerContainer) return;

    // Fetch the header template only if it hasn't been fetched before
    if (!headerHTMLTemplate) {
        try {
            const response = await fetch('/global/header.html');
            if (response.ok) {
                headerHTMLTemplate = await response.text();
            } else {
                 console.error('Failed to load header HTML.');
                 return;
            }
        } catch (error) {
            console.error('Error fetching header HTML:', error);
            return;
        }
    }
    
    headerContainer.innerHTML = headerHTMLTemplate;
    
    const navLinks = headerContainer.querySelector('.nav-links');
    const headerUserStats = headerContainer.querySelector('.header-user-stats');

    if (!navLinks || !headerUserStats) return;

    // Default to hidden
    headerContainer.classList.add('hidden');
    headerUserStats.classList.add('hidden');

    let navHtml = '';

    if (user && !user.isGuest) {
        headerContainer.classList.remove('hidden');
        navHtml = `
            <li><a href="#home" class="nav-link" data-route="home"><span class="nav-link-text">Dashboard</span></a></li>
            <li><a href="#progress" class="nav-link" data-route="progress"><span class="nav-link-text">Analytics</span></a></li>
            <li><a href="#library" class="nav-link" data-route="library"><span class="nav-link-text">My Library</span></a></li>
            <li><a href="#settings" class="nav-link" data-route="settings"><span class="nav-link-text">Settings</span></a></li>
            <li><button id="logout-btn" class="nav-link"><span class="btn-content">Logout</span></button></li>
        `;
    }
    
    navLinks.innerHTML = navHtml;

    if (user) {
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
        if (progress) {
            headerUserStats.classList.remove('hidden');
            const totalXp = progress.totalXp || 0;
            const level = progressService.calculateLevel(totalXp).level;
            headerUserStats.querySelector('#header-level').textContent = level;
            headerUserStats.querySelector('#header-streak').textContent = progress.streak || 0;
        }
    }
    
    // Hamburger menu for mobile
    const hamburger = headerContainer.querySelector('.nav-hamburger');
    if(hamburger) {
        hamburger.onclick = () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        };
    }
}


async function handleLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;
    const btnContent = logoutBtn.querySelector('.btn-content');
    
    btnContent.innerHTML = `<div class="spinner"></div>`;
    logoutBtn.disabled = true;

    try {
        await authService.logOut();
        // The session state change listener will handle routing.
        showToast('You have been successfully signed out.', 'success');
    } catch (error) {
        showToast('Logout failed. Please try again.', 'error');
        btnContent.textContent = authService.isGuest() ? 'Exit Guest Mode' : 'Logout';
    } finally {
        logoutBtn.disabled = false;
    }
}

// --- ROUTING ---
const loadModule = async (moduleName, context = {}) => {
    if (currentModule && currentModule.cleanup) {
        currentModule.cleanup();
    }
    
    sessionStorage.setItem(MODULE_CONTEXT_KEY, JSON.stringify(context));

    const rootContainer = document.getElementById('root-container');
    rootContainer.classList.add('module-exit');

    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module '${moduleName}' not found.`);
        rootContainer.innerHTML = await response.text();
        
        currentModule = await import(`../modules/${moduleName}/${moduleName}.js`);
        if (currentModule.init) {
            await currentModule.init();
        }
    } catch (error) {
        console.error(`Failed to load module ${moduleName}:`, error);
        rootContainer.innerHTML = `
            <div class="card" style="text-align: center;">
                <h2>Error Loading Page</h2>
                <p style="margin: 1rem 0;">Could not load the requested content. It might be an issue with your connection or the application.</p>
                <a href="#home" class="btn btn-primary">Return to Dashboard</a>
            </div>
        `;
    } finally {
        rootContainer.classList.remove('module-exit');
        rootContainer.classList.add('module-enter');
        setTimeout(() => rootContainer.classList.remove('module-enter'), 300);
        updateActiveNavLink();
    }
};

const router = async () => {
    const hash = window.location.hash || '#';
    const [path] = hash.slice(1).split('/');
    const cleanPath = path || (currentUser ? 'home' : 'welcome');
    
    const user = currentUser;
    const publicRoutes = ['welcome', 'login', 'signup'];

    if (!user && !publicRoutes.includes(cleanPath)) {
        window.location.hash = '#welcome';
        return;
    }
    
    if (user && publicRoutes.includes(cleanPath)) {
        window.location.hash = '#home';
        return;
    }

    const routeConfig = ROUTES[cleanPath] || ROUTES['home'];
    const [, param] = hash.slice(1).split('/');
    
    await loadModule(routeConfig.module, { ...routeConfig.context, param });
};

function updateActiveNavLink() {
    const hash = window.location.hash || '#home';
    document.querySelectorAll('.nav-link').forEach(link => {
        const route = link.getAttribute('data-route');
        if (route && hash.includes(route)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- INITIALIZATION ---
function applyInitialTheme() {
    const settings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
    const theme = settings.theme || 'cyber'; // Default to cyber theme
    document.documentElement.setAttribute('data-theme', theme);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('ServiceWorker registration successful.'))
                .catch(err => console.error('ServiceWorker registration failed: ', err));
        });
    }
}

async function initializeApp() {
    applyInitialTheme();
    registerServiceWorker();
    initUIEffects();
    
    authService.onSessionStateChange(async (user) => {
        currentUser = user;
        
        if (user) {
            userProgress = await progressService.getProgress();
            // Check for isNewUser is now handled inside authService to avoid race conditions
            if (!user.isGuest && user.isNewUser) {
                showWelcomeModal();
                // Mark user as not new anymore
                await authService.updateUserAccount({ isNewUser: false });
            }
        } else {
            userProgress = null;
        }

        await updateHeaderUI(currentUser, userProgress);
        router();
    });

    // Initial check
    authService.initializeSession();

    window.addEventListener('hashchange', router);
    
    // The splash screen will be hidden by the first module that loads successfully.
    document.addEventListener('moduleReady', hideSplashScreen, { once: true });
}

// Start the application
initializeApp();