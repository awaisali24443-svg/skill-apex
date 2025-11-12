// index.js - Main Application Entry Point

import { ROUTES, APP_STATE_KEY } from './constants.js';
import { updateMetaTags } from './services/seoService.js';
import { getAllSettings } from './services/configService.js';
import { createIndex } from './services/searchService.js';
import { soundService } from './services/soundService.js';
import { threeManager } from './services/threeManager.js';
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

// --- DOM Elements ---
const appContainer = document.getElementById('app');
const sidebarContainer = document.getElementById('sidebar-container');
const splashScreen = document.getElementById('splash-screen');

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
        return;
    }

    appContainer.classList.add('fade-out');

    if (currentModule?.instance?.destroy) {
        currentModule.instance.destroy();
    }
    if (currentModule?.hash === 'home' && route.hash !== 'home') {
        threeManager.destroy();
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
        
        appContainer.classList.toggle('galaxy-view', route.hash === 'home');
        appContainer.innerHTML = `<style>${css}</style>${html}`;
        currentModule = { ...route, instance: js };
        
        const onReady = route.hash === 'home' ? hideSplashScreen : () => {};

        if (js.init) {
             if (route.hash === 'home') {
                await js.init(appContainer, appState, onReady);
             } else {
                await js.init(appState);
             }
        }
        
        if (route.hash !== 'home') hideSplashScreen();

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
async function main() {
    renderSidebar();
    applyBodySettings();

    window.addEventListener('settings-changed', applyBodySettings);
    document.body.addEventListener('click', () => soundService.init(), { once: true });
    
    await createIndex();

    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Initial route load
}

// --- Entry Point ---
document.addEventListener('DOMContentLoaded', main);
