
import { ROUTES, APP_STATE_KEY } from './constants.js';
import { setSetting, getSetting, getAllSettings } from './services/configService.js';
import { endQuiz } from './services/quizStateService.js';
import { updateMetaTags } from './services/seoService.js';
import { createIndex as createSearchIndex } from './services/searchService.js';
import { soundService } from './services/soundService.js'; // NEW

const app = document.getElementById('app');
const sidebarContainer = document.getElementById('sidebar-container');
const splashScreen = document.getElementById('splash-screen');

const moduleCache = new Map();

// Global state object
const appState = {
    _context: {},
    get context() {
        return this._context;
    },
    /**
     * ARCHITECTURAL FIX: This setter is now hardened to prevent state pollution.
     * It intelligently preserves the router `params` while replacing the rest of the context.
     * This ensures that navigating between modules doesn't leave behind stale data that
     * could corrupt the state of the next module.
     */
    set context(data) {
        // Preserve existing params unless new ones are explicitly provided
        const newContext = { 
            ...data, 
            params: data.params || this._context.params 
        };
        this._context = newContext;

        try {
            sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(this._context));
        } catch (error)
        {
            console.warn("Could not write to sessionStorage.", error);
        }
    },
    setRouteParams(params) {
        this._context.params = params;
        try {
            sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(this._context));
        } catch (error) {
            console.warn("Could not write to sessionStorage.", error);
        }
    }
};

let currentModule = null;

async function loadModule(moduleConfig, params = {}) {
    if (currentModule && currentModule.path === moduleConfig.path) {
        return; // Avoid reloading the same module
    }

    // --- Cleanup previous module ---
    if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
        // FIX #3: If navigating away from quiz, ensure state is cleared.
        if (currentModule.path.startsWith('quiz')) {
            endQuiz();
        }
        currentModule.instance.destroy();
    }
    document.querySelector(`link[data-module-id]`)?.remove();
    // FIX #11: Add a fade-out animation instead of instantly clearing content
    app.classList.add('fade-out');
    
    // Wait for fade out to complete before clearing
    await new Promise(resolve => setTimeout(resolve, 200)); 


    currentModule = { ...moduleConfig, instance: null };
    app.innerHTML = ''; // Now clear the content

    // --- Load new module ---
    try {
        const path = moduleConfig.path || moduleConfig.module;
        if (!moduleCache.has(path)) {
            const [html, css, js] = await Promise.all([
                fetch(`/modules/${path}/${path}.html`).then(res => res.text()),
                fetch(`/modules/${path}/${path}.css`).then(res => res.text()),
                import(`./modules/${path}/${path}.js`)
            ]);
            moduleCache.set(path, { html, css, js });
        }

        const { html, css, js } = moduleCache.get(path);

        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-module-id', path);
        document.head.appendChild(style);

        app.innerHTML = html;
        currentModule.instance = js;
        
        // Pass params from router to the module's init function
        appState.setRouteParams(params);
        if (typeof js.init === 'function') {
            await js.init(appState);
        }
        
        // Fade in new content
        app.classList.remove('fade-out');


    } catch (error) {
        console.error(`Failed to load module: ${moduleConfig.path}`, error);
        app.innerHTML = `<div class="error-container"><h2>Error</h2><p>Could not load page. Please try again.</p></div>`;
        app.classList.remove('fade-out');
    }
}

// FIX #2: New dynamic router
async function handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'home';
    
    const [path, ...params] = hash.split('/');
    
    let matchedRoute = null;
    let routeParams = {};

    for (const route of ROUTES) {
        const routeParts = route.hash.split('/');
        const pathParts = hash.split('/');

        if (routeParts.length !== pathParts.length) continue;

        let isMatch = true;
        let tempParams = {};

        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                const paramName = routeParts[i].substring(1);
                tempParams[paramName] = pathParts[i];
            } else if (routeParts[i] !== pathParts[i]) {
                isMatch = false;
                break;
            }
        }
        
        if (isMatch) {
            matchedRoute = route;
            routeParams = tempParams;
            break;
        }
    }

    if (matchedRoute) {
        await loadModule(matchedRoute, routeParams);
        updateActiveNavLink(matchedRoute.hash);
        await updateMetaTags(matchedRoute.name, routeParams);
    } else {
        // Fallback to a 'not found' module or redirect to home
        console.warn(`No route found for hash: ${hash}`);
        window.location.hash = '#home';
    }
}


function applyBodyClasses() {
    const settings = getAllSettings();
    document.body.classList.toggle('large-text', settings.largeText);
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('dyslexia-font', settings.dyslexiaFont);
    document.body.setAttribute('data-theme', settings.theme || 'cyber');
}

async function loadSidebar() {
    try {
        const response = await fetch('/global/sidebar.html');
        const sidebarHtml = await response.text();
        sidebarContainer.innerHTML = sidebarHtml;
        populateNavLinks();
    } catch (error) {
        console.error("Failed to load sidebar:", error);
    }
}

function populateNavLinks() {
    const navLinksContainer = sidebarContainer.querySelector('.nav-links');
    if (!navLinksContainer) return;
    navLinksContainer.innerHTML = ROUTES
        .filter(route => route.inNav)
        .map(route => `
            <li>
                <a href="#${route.hash.split('/')[0]}" class="nav-link" data-hash="${route.hash.split('/')[0]}">
                    <span class="nav-icon">${route.icon}</span>
                    <span class="nav-text">${route.name}</span>
                </a>
            </li>
        `)
        .join('');
}

function updateActiveNavLink(currentHash) {
    const hashBase = currentHash.split('/')[0];
    // Get all navigation links
    const navLinks = sidebarContainer.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.hash === hashBase);
    });
}

function init() {
    // FIX #2: Restore state from sessionStorage on load
    try {
        const storedState = sessionStorage.getItem(APP_STATE_KEY);
        if (storedState) {
            appState._context = JSON.parse(storedState);
        }
    } catch (error) {
        console.warn("Could not parse stored app state.", error);
        sessionStorage.removeItem(APP_STATE_KEY);
    }

    applyBodyClasses();
    window.addEventListener('settings-changed', applyBodyClasses);

    // Build the search index for the explore page
    createSearchIndex();
    
    // NEW: Initialize the sound service
    soundService.init();
    
    // FIX #15: Ensure sidebar is loaded before routing
    loadSidebar().then(() => {
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange(); // Initial route
    });
    
    // Hide splash screen after a delay
    setTimeout(() => {
        if(splashScreen) splashScreen.classList.add('fade-out');
    }, 3800);
}

init();