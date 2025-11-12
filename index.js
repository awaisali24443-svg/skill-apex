import { ROUTES } from './constants.js';
import * as configService from './services/configService.js';
import * as searchService from './services/searchService.js';
import { renderSidebar } from './services/sidebarService.js';
import { showFatalError } from './services/errorService.js';
import * as soundService from './services/soundService.js';
import * as learningPathService from './services/learningPathService.js';

const appState = {
    currentModule: null,
    context: {},
};

const moduleCache = new Map();

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


async function loadModule(route) {
    const appContainer = document.getElementById('app');
    const styleTagId = 'module-style';

    if (appState.currentModule && appState.currentModule.js.destroy) {
        try {
            appState.currentModule.js.destroy();
        } catch (e) {
            console.error('Error destroying module:', e);
        }
    }

    appContainer.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        // Pass route params into the app state context
        appState.context.params = route.params;

        const moduleData = await fetchModule(route.module);
        appState.currentModule = moduleData;

        // Clear previous content and apply full-bleed if needed
        appContainer.innerHTML = '';
        document.getElementById('app-container').classList.toggle('full-bleed-container', !!route.fullBleed);
        
        let styleTag = document.getElementById(styleTagId);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleTagId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = moduleData.css;
        appContainer.innerHTML = moduleData.html;

        if (moduleData.js.init) {
            await moduleData.js.init(appState);
        }

        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
            // Use startsWith to handle dynamic routes like /learning-path/:id
            const linkPath = link.getAttribute('href').slice(1);
            if (route.path.startsWith(linkPath) && (linkPath !== '/' || route.path === '/')) {
                link.classList.add('active');
            }
        });
        
        // Reset scroll position for the new view
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
        appContainer.classList.remove('fade-out');
    }
}

function handleRouteChange() {
    const path = window.location.hash.slice(1) || '/';
    const route = matchRoute(path);

    if (route) {
        loadModule(route);
    } else {
        // Handle 404
        loadModule(ROUTES.find(r => r.path === '/'));
        console.warn(`No route found for path: ${path}. Redirecting to home.`);
    }
}

async function main() {
    try {
        // Initialize services
        configService.init();
        soundService.init(configService);
        learningPathService.init();

        // Register service worker for PWA capabilities
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registered', reg))
                    .catch(err => console.error('Service Worker registration failed', err));
            });
        }

        // Render static UI elements
        renderSidebar(document.getElementById('sidebar'));

        // Set up routing
        window.addEventListener('hashchange', handleRouteChange);

        // Initial load
        handleRouteChange();

        // Must happen after initial route change to ensure DOM is populated
        await searchService.createIndex();

        // Hide splash screen
        document.getElementById('splash-screen').classList.add('hidden');

    } catch (error) {
        console.error("A critical error occurred during application startup:", error);
        showFatalError(error);
    }
}

// Start the application
main();
