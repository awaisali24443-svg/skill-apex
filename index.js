// index.js - Main Application Entry Point

import { ROUTES, APP_STATE_KEY } from './constants.js';
import { updateMetaTags } from './services/seoService.js';
import { getAllSettings } from './services/configService.js';
import { createIndex } from './services/searchService.js';
import { soundService } from './services/soundService.js';
import { isFeatureEnabled } from './services/featureService.js';

// --- Global State ---
const appState = {
    get context() {
        try {
            const stored = sessionStorage.getItem(APP_STATE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    },
    set context(data) {
        try {
            const current = this.context;
            const merged = { ...current, ...data };
            sessionStorage.setItem(APP_STATE_KEY, JSON.stringify(merged));
        } catch (e) {
            console.error("Failed to save app state to session storage", e);
        }
    }
};

// --- Module Cache ---
const moduleCache = new Map();
let currentModule = null;

// --- DOM Elements (will be initialized in main()) ---
let appContainer, sidebarContainer, splashScreen;

// --- Core Functions ---

/**
 * Renders the sidebar navigation links from sidebar.html template.
 */
async function renderSidebar() {
    try {
        const response = await fetch('/global/sidebar.html');
        if (!response.ok) throw new Error('Sidebar template not found');
        const html = await response.text();
        sidebarContainer.innerHTML = html;
        const navLinksContainer = sidebarContainer.querySelector('.nav-links');
        
        const navLinks = ROUTES
            .filter(route => route.inNav && (!route.featureFlag || isFeatureEnabled(route.featureFlag)))
            .map(route => `
                <li>
                    <a href="#${route.hash}" class="nav-link" data-nav-id="${route.hash}">
                        <span class="nav-icon">${route.icon}</span>
                        <span class="nav-text">${route.name}</span>
                    </a>
                </li>
            `).join('');
        
        if (navLinksContainer) {
            navLinksContainer.innerHTML = navLinks;
        }
    } catch (error) {
        console.error("Failed to render sidebar:", error);
        sidebarContainer.innerHTML = '<p style="color:red; text-align:center;">Error loading nav</p>';
    }
}

/**
 * Matches a URL hash to a route config, handling dynamic segments like :id.
 * @param {string} hash - The URL hash (e.g., '#topics/science-nature').
 * @returns {object} The matched route configuration object.
 */
function matchRoute(hash) {
    const path = hash.substring(1) || 'home';
    const pathParts = path.split('/');

    for (const route of ROUTES) {
        const routeParts = route.hash.split('/');
        if (routeParts.length !== pathParts.length) continue;

        const params = {};
        const isMatch = routeParts.every((part, i) => {
            if (part.startsWith(':')) {
                params[part.substring(1)] = pathParts[i];
                return true;
            }
            return part === pathParts[i];
        });

        if (isMatch) {
            return { ...route, params };
        }
    }
    // Fallback to home if no match is found
    return ROUTES.find(r => r.hash === 'home');
}

/**
 * Loads and initializes a module based on its route configuration.
 * @param {object} route - The route configuration object.
 */
async function loadModule(route) {
    if (!route || !route.module) {
        console.error("Router error: Invalid route or module definition provided.", route);
        appContainer.innerHTML = '<h2>Error: Page not found</h2><p>The requested module is not configured correctly.</p>';
        hideSplashScreen(); // Hide even on this critical error
        return;
    }
    
    // Hide the splash screen as soon as we know we're loading a module.
    // This makes the app feel much more responsive.
    hideSplashScreen();

    appContainer.classList.add('fade-out');

    if (currentModule?.instance?.destroy) {
        currentModule.instance.destroy();
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.navId === route.hash.split('/')[0]);
    });

    updateMetaTags(route.name, route.params);

    try {
        if (!moduleCache.has(route.module)) {
            const [html, js, cssRes] = await Promise.all([
                fetch(`/modules/${route.module}/${route.module}.html`).then(res => res.text()),
                import(`./modules/${route.module}/${route.module}.js`),
                fetch(`/modules/${route.module}/${route.module}.css`)
            ]);
            const css = cssRes.ok ? await cssRes.text() : '';
            moduleCache.set(route.module, { html, css, js });
        }

        const { html, css, js } = moduleCache.get(route.module);
        
        appContainer.innerHTML = `<style>${css}</style>${html}`;
        currentModule = { ...route, instance: js };
        
        if (js.init) {
            await js.init(appState);
        }

    } catch (error) {
        console.error(`Failed to load module ${route.module}:`, error);
        appContainer.innerHTML = `<h2>Error loading ${route.name}</h2><p>Please try refreshing the page.</p>`;
    } finally {
        appContainer.classList.remove('fade-out');
        window.scrollTo(0, 0);
    }
}

/**
 * Main router function, triggered by hash changes.
 */
function handleRouteChange() {
    const hash = window.location.hash || '#home';
    const route = matchRoute(hash);
    
    if (route.params) {
        appState.context = { ...appState.context, params: route.params };
    }
    
    if (route.featureFlag && !isFeatureEnabled(route.featureFlag)) {
        console.warn(`Access to disabled feature "${route.featureFlag}" blocked. Redirecting.`);
        const placeholderRoute = ROUTES.find(r => r.hash === 'placeholder');
        loadModule(placeholderRoute);
        return;
    }
    
    loadModule(route);
}

function hideSplashScreen() {
    if (splashScreen && !splashScreen.classList.contains('fade-out')) {
        splashScreen.classList.add('fade-out');
    }
}

function applyBodySettings() {
    const settings = getAllSettings();
    document.body.className = '';
    document.body.classList.toggle('large-text', !!settings.largeText);
    document.body.classList.toggle('high-contrast', !!settings.highContrast);
    document.body.classList.toggle('dyslexia-font', !!settings.dyslexiaFont);
    document.body.setAttribute('data-theme', settings.theme || 'cyber');
}

/**
 * Main application initialization.
 */
function main() {
    try {
        // --- Initialize DOM element references ---
        appContainer = document.getElementById('app');
        sidebarContainer = document.getElementById('sidebar-container');
        splashScreen = document.getElementById('splash-screen');

        if (!appContainer || !sidebarContainer || !splashScreen) {
            throw new Error("Core application elements are missing from the DOM.");
        }

        // Apply settings immediately to prevent style flashes
        applyBodySettings();

        // Set up event listeners
        window.addEventListener('settings-changed', applyBodySettings);
        document.body.addEventListener('click', () => soundService.init(), { once: true });
        window.addEventListener('hashchange', handleRouteChange);
        
        // Start loading the initial page content AND the sidebar concurrently.
        // The router will now hide the splash screen quickly.
        handleRouteChange();
        renderSidebar();

        // Build the search index in the background without blocking the UI.
        createIndex();
    } catch (error) {
        console.error("A critical error occurred during application startup:", error);
        hideSplashScreen();
        if (appContainer) {
            appContainer.innerHTML = `
                <div style="text-align: center; padding: 4rem; color: var(--color-danger);">
                    <h2>Oops! Something went wrong.</h2>
                    <p>The application failed to start. Please try refreshing the page.</p>
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 1rem;">Error: ${error.message}</p>
                    <button class="btn" onclick="window.location.reload()">Reload</button>
                </div>
            `;
        }
    }
}

// --- Entry Point ---
// CRITICAL FIX: Use the 'load' event instead of 'DOMContentLoaded'.
// 'load' waits for all resources including stylesheets to be fully loaded,
// preventing a race condition where the script tries to animate the splash
// screen before its CSS is ready.
window.addEventListener('load', main);