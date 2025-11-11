import { ROUTES, APP_STATE_KEY } from './constants.js';
import { setSetting, getSetting, getAllSettings } from './services/configService.js';
import { endQuiz } from './services/quizStateService.js';
import { updateMetaTags } from './services/seoService.js';
import { createIndex as createSearchIndex } from './services/searchService.js';

const app = document.getElementById('app');
const headerContainer = document.getElementById('header-container');
const splashScreen = document.getElementById('splash-screen');
const bgCanvas = document.getElementById('bg-canvas');

const moduleCache = new Map();

// Global state object
const appState = {
    _context: {},
    get context() {
        return this._context;
    },
    set context(data) {
        this._context = { ...this._context, ...data };
        try {
            sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(this._context));
        } catch (error) {
            console.warn("Could not write to sessionStorage.", error);
        }
    },
    // FIX: Add a specific method for setting router params to prevent state corruption.
    setRouteParams(params) {
        this._context.params = params; // Direct replacement of only the params property.
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
        if (!moduleCache.has(moduleConfig.path)) {
            const [html, css, js] = await Promise.all([
                fetch(`/modules/${moduleConfig.path}/${moduleConfig.path}.html`).then(res => res.text()),
                fetch(`/modules/${moduleConfig.path}/${moduleConfig.path}.css`).then(res => res.text()),
                import(`./modules/${moduleConfig.path}/${moduleConfig.path}.js`)
            ]);
            moduleCache.set(moduleConfig.path, { html, css, js });
        }

        const { html, css, js } = moduleCache.get(moduleConfig.path);

        const style = document.createElement('style');
        style.textContent = css;
        style.setAttribute('data-module-id', moduleConfig.path);
        document.head.appendChild(style);

        app.innerHTML = html;
        currentModule.instance = js;
        
        // Pass params from router to the module's init function
        appState.setRouteParams(params); // Use the new, safer method.
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
    
    // Manage background canvas visibility
    if (bgCanvas) {
        const settings = getAllSettings();
        if (hash.startsWith('home') && settings.enable3DBackground) {
            bgCanvas.classList.add('visible');
        } else {
            bgCanvas.classList.remove('visible');
        }
    }

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
        await loadModule({ path: matchedRoute.module, name: matchedRoute.name }, routeParams);
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
    document.body.setAttribute('data-theme', settings.theme || 'aurora');
}

async function loadHeader() {
    try {
        const response = await fetch('/global/header.html');
        const headerHtml = await response.text();
        headerContainer.innerHTML = headerHtml;
        setupHeaderListeners();
        populateNavLinks();

        // --- Header Scroll Effect Listener ---
        const headerEl = headerContainer.querySelector('.site-nav');
        if (headerEl) {
            const handleScroll = () => {
                if (window.scrollY > 10) {
                    headerEl.classList.add('scrolled');
                } else {
                    headerEl.classList.remove('scrolled');
                }
            };
            // Set initial state
            handleScroll();
            // Add listener
            window.addEventListener('scroll', handleScroll, { passive: true });
        }
    } catch (error) {
        console.error("Failed to load header:", error);
    }
}

function populateNavLinks() {
    const navLinksContainer = headerContainer.querySelector('.nav-links');
    if (!navLinksContainer) return;
    navLinksContainer.innerHTML = ROUTES
        .filter(route => route.inNav)
        .map(route => `<li><a href="#${route.hash.split('/')[0]}" class="nav-link">${route.name}</a></li>`)
        .join('');
}

// FIX #10, #25: Functional mobile navigation
function setupHeaderListeners() {
    const hamburger = headerContainer.querySelector('.nav-hamburger');
    const navLinks = headerContainer.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            headerContainer.classList.toggle('nav-open');
        });
        
        // Close nav when a link is clicked
        navLinks.addEventListener('click', (e) => {
             if (e.target.classList.contains('nav-link')) {
                 headerContainer.classList.remove('nav-open');
             }
        });
    }
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
    
    // FIX #15: Ensure header is loaded before routing
    loadHeader().then(() => {
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange(); // Initial route
    });
    
    // Hide splash screen after a delay
    setTimeout(() => {
        if(splashScreen) splashScreen.classList.add('fade-out');
    }, 3800);
}

init();