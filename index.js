
import { ROUTES, LOCAL_STORAGE_KEYS } from './constants.js';
import * as configService from './services/configService.js';
import { renderSidebar } from './services/sidebarService.js';
import { showFatalError } from './services/errorService.js';
import * as soundService from './services/soundService.js';
import * as learningPathService from './services/learningPathService.js';
import * as historyService from './services/historyService.js';
import * as themeService from './services/themeService.js';
import * as gamificationService from './services/gamificationService.js';
import * as stateService from './services/stateService.js';
import * as voiceCommandService from './services/voiceCommandService.js';

const moduleCache = new Map();
let currentModule = null;

async function fetchModule(moduleName) {
    if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName);
    }
    try {
        const [html, css, js] = await Promise.all([
            fetch(`./modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
            fetch(`./modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
            import(`./modules/${moduleName}/${moduleName}.js`)
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
    if (!appContainer) return;

    if (currentModule && currentModule.js.destroy) {
        try {
            currentModule.js.destroy();
        } catch (e) {
            console.error('Error destroying module:', e);
        }
    }

    const renderNewModule = async () => {
        try {
            stateService.setCurrentRoute(route);
            const moduleData = await fetchModule(route.module);
            currentModule = moduleData;

            appContainer.innerHTML = '';
            document.getElementById('app-container')?.classList.toggle('full-bleed-container', !!route.fullBleed);
            
            let styleTag = document.getElementById('module-style');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'module-style';
                document.head.appendChild(styleTag);
            }
            styleTag.textContent = moduleData.css;

            appContainer.innerHTML = moduleData.html;

            if (moduleData.js.init) {
                await moduleData.js.init();
            }
            
            stateService.clearNavigationContext();

            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
                const linkPath = link.getAttribute('href')?.slice(1) || '';
                if (route.path.startsWith(linkPath) && (linkPath !== '/' || route.path === '/')) {
                    link.classList.add('active');
                }
            });
            
            document.getElementById('app-container').scrollTop = 0;

            const mainHeading = appContainer.querySelector('h1');
            if (mainHeading) {
                mainHeading.setAttribute('tabindex', '-1');
                mainHeading.focus({ preventScroll: true });
            }

        } catch (error) {
            console.error("Failed to load module:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            appContainer.innerHTML = `
                <div class="error-page card">
                    <h2>Error Loading Module</h2>
                    <p>${errorMessage}</p>
                    <a href="#" class="btn">Go Home</a>
                </div>
            `;
        }
    };

    if (document.startViewTransition) {
        const transition = document.startViewTransition(async () => {
             await renderNewModule();
        });
    } else {
        await renderNewModule();
    }
}

function handleHelperModal() {
    const modal = document.getElementById('help-modal');
    const closeBtn = document.getElementById('close-help-btn');
    if(closeBtn && modal) {
        closeBtn.onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; }
    }
}

function handleRouteChange() {
    const path = window.location.hash.slice(1) || '/';
    const route = matchRoute(path);

    if (route) {
        loadModule(route);
    } else {
        const homeRoute = ROUTES.find(r => r.path === '/');
        if(homeRoute) {
            loadModule(homeRoute);
        }
    }
}

async function main() {
    try {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredInstallPrompt = e;
        });

        configService.init();
        soundService.init(configService);
        learningPathService.init();
        historyService.init();
        gamificationService.init();
        stateService.initState();
        voiceCommandService.init(); // Init Voice Command Service

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js');
            });
        }

        renderSidebar(document.getElementById('sidebar'));
        handleHelperModal();

        window.addEventListener('hashchange', handleRouteChange);
        window.addEventListener('settings-changed', (e) => themeService.applyTheme(e.detail.theme));
        
        // Sound Triggers
        document.body.addEventListener('click', (event) => {
            if (event.target.closest('.btn, .sidebar-link, .topic-card')) {
                soundService.playSound('click');
            }
        });

        const offlineIndicator = document.getElementById('offline-indicator');
        window.addEventListener('online', () => offlineIndicator.style.display = 'none');
        window.addEventListener('offline', () => offlineIndicator.style.display = 'block');

        handleRouteChange();

        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            splashScreen.addEventListener('transitionend', () => splashScreen.remove());
            splashScreen.classList.add('hidden');
            setTimeout(() => splashScreen.remove(), 600);
        }

    } catch (error) {
        showFatalError(error);
    }
}

main();
