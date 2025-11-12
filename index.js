import { ROUTES } from './constants.js';
import * as configService from './services/configService.js';
import * as searchService from './services/searchService.js';
import { renderSidebar } from './services/sidebarService.js';
import { showFatalError } from './services/errorService.js';
import * as soundService from './services/soundService.js';
import * as learningPathService from './services/learningPathService.js';
import * as historyService from './services/historyService.js';
import * as themeService from './services/themeService.js';
import * as backgroundService from './services/backgroundService.js';

// appState holds the current module and a context object for passing data between modules.
const appState = {
    currentModule: null,
    context: {},
};

// Caches loaded modules to avoid redundant network requests.
const moduleCache = new Map();

/**
 * Fetches the HTML, CSS, and JS for a given module.
 * Caches the module artifacts for subsequent loads.
 * @param {string} moduleName - The name of the module to load.
 * @returns {Promise<object>} An object containing the module's html, css, and js module.
 */
async function fetchModule(moduleName) {
    if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName);
    }
    try {
        const [html, css, js] = await Promise.all([
            fetch(`/modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
            fetch(`/modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
            import(`/modules/${moduleName}/${moduleName}.js`)
        ]);
        const moduleData = { html, css, js };
        moduleCache.set(moduleName, moduleData);
        return moduleData;
    } catch (error) {
        console.error(`Failed to load module: ${moduleName}`, error);
        throw new Error(`Module ${moduleName} could not be loaded.`);
    }
}

/**
 * Matches a given path (e.g., from location.hash) to a defined route.
 * Supports dynamic route parameters like '/learning-path/:id'.
 * @param {string} path - The path to match.
 * @returns {object|null} The matched route object with params, or null if no match.
 */
function matchRoute(path) {
    for (const route of ROUTES) {
        const paramNames = [];
        const regexPath = route.path.replace(/:(\w+)/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)';
        });
        const regex = new RegExp(`^${regexPath}$`);
        const match = path.match(regex);

        if (match) {
            const params = {};
            paramNames.forEach((name, index) => {
                params[name] = decodeURIComponent(match[index + 1]);
            });
            return { ...route, params };
        }
    }
    return null;
}

/**
 * Core function to load and render a module into the DOM.
 * Handles module lifecycle (destroying old, initializing new), styling, and page transitions.
 * @param {object} route - The route object returned by matchRoute.
 */
async function loadModule(route) {
    const appContainer = document.getElementById('app');
    const styleTagId = 'module-style';

    // 1. Destroy the previous module if it has a destroy function.
    if (appState.currentModule && appState.currentModule.js.destroy) {
        try {
            appState.currentModule.js.destroy();
        } catch (e) {
            console.error('Error destroying module:', e);
        }
    }

    // 2. Animate the page out using a more robust method.
    await new Promise(resolve => {
        const handler = (event) => {
            // Ensure the event is for the appContainer itself
            if (event.target === appContainer) {
                appContainer.removeEventListener('transitionend', handler);
                resolve();
            }
        };
        appContainer.addEventListener('transitionend', handler);
        appContainer.classList.add('fade-out');
        // Fallback timer in case transitionend doesn't fire (e.g., element is hidden)
        setTimeout(resolve, 350);
    });

    try {
        // Pass route params into the app state context for the new module.
        appState.context.params = route.params;

        // 3. Fetch the new module's assets.
        const moduleData = await fetchModule(route.module);
        appState.currentModule = moduleData;

        // 4. Prepare the DOM for the new module.
        appContainer.innerHTML = '';
        document.getElementById('app-container').classList.toggle('full-bleed-container', !!route.fullBleed);
        
        // 5. Apply module-specific styles.
        let styleTag = document.getElementById(styleTagId);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleTagId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = moduleData.css;

        // 6. Inject the module's HTML.
        appContainer.innerHTML = moduleData.html;

        // 7. Initialize the new module's JavaScript.
        if (moduleData.js.init) {
            await moduleData.js.init(appState);
        }

        // 8. Update the active state in the sidebar navigation.
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
            // Use startsWith to handle dynamic routes like /learning-path/:id
            const linkPath = link.getAttribute('href').slice(1);
            if (route.path.startsWith(linkPath) && (linkPath !== '/' || route.path === '/')) {
                link.classList.add('active');
            }
        });
        
        // Reset scroll position for the new view.
        document.getElementById('app-container').scrollTop = 0;


    } catch (error) {
        console.error("Failed to load module:", error);
        appContainer.innerHTML = `
            <div class="error-page card">
                <h2>Error Loading Module</h2>
                <p>${error.message}</p>
                <a href="/#" class="btn">Go Home</a>
            </div>
        `;
    } finally {
        // 9. Animate the new page in.
        appContainer.classList.remove('fade-out');
    }
}

/**
 * Handles the hashchange event to navigate between modules.
 */
function handleRouteChange() {
    const path = window.location.hash.slice(1) || '/';
    const route = matchRoute(path);

    if (route) {
        loadModule(route);
    } else {
        // Handle 404 by redirecting to the home page.
        loadModule(ROUTES.find(r => r.path === '/'));
        console.warn(`No route found for path: ${path}. Redirecting to home.`);
    }
}

/**
 * The main entry point for the application.
 * Initializes services, renders static UI, sets up routing, and hides the splash screen.
 */
async function main() {
    try {
        // Initialize all core services
        configService.init();
        themeService.applyTheme(configService.getConfig().theme); // Apply theme on startup
        backgroundService.init();
        soundService.init(configService);
        learningPathService.init();
        historyService.init();

        // Register service worker for PWA capabilities and offline functionality.
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registered', reg))
                    .catch(err => console.error('Service Worker registration failed', err));
            });
        }

        // Render static UI elements like the sidebar.
        renderSidebar(document.getElementById('sidebar'));

        // Set up event listeners for routing.
        window.addEventListener('hashchange', handleRouteChange);
        
        // Global click sound handler
        document.body.addEventListener('click', (event) => {
            // Play sound for specific interactive elements
            if (event.target.closest('.btn, .sidebar-link, .topic-button, .option-btn, .flashcard')) {
                soundService.playSound('click');
            }
        });


        // Initial data fetch and page load.
        await searchService.createIndex();
        handleRouteChange();


        // Hide the splash screen once the app is ready.
        document.getElementById('splash-screen').classList.add('hidden');

    } catch (error) {
        console.error("A critical error occurred during application startup:", error);
        showFatalError(error);
    }
}

// Start the application.
main();