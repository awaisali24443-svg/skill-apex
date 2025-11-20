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

    // View Transitions API
    if (document.startViewTransition) {
        const transition = document.startViewTransition(async () => {
             await renderNewModule();
        });
    } else {
        // Fallback for older browsers
        await new Promise(resolve => {
            const handler = (event) => {
                if (event.target === appContainer) {
                    appContainer.removeEventListener('transitionend', handler);
                    resolve();
                }
            };
            appContainer.addEventListener('transitionend', handler);
            appContainer.classList.add('fade-out');
            setTimeout(resolve, 350);
        });
        
        await renderNewModule();
        appContainer.classList.remove('fade-out');
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

function applyAppSettings(config) {
    themeService.applyTheme(config.theme);
    themeService.applyAnimationSetting(config.animationIntensity);
}

function showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const startBtn = document.getElementById('welcome-get-started-btn');
    if (!welcomeScreen || !startBtn) return;

    welcomeScreen.style.display = 'flex';
    setTimeout(() => {
        welcomeScreen.classList.add('visible');
    }, 10);
    
    startBtn.addEventListener('click', () => {
        localStorage.setItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED, 'true');
        welcomeScreen.classList.remove('visible');
        
        welcomeScreen.addEventListener('transitionend', () => {
            welcomeScreen.remove();
        }, { once: true });
        
        setTimeout(() => {
            if (document.body.contains(welcomeScreen)) {
                welcomeScreen.remove();
            }
        }, 500);
    }, { once: true });
}

async function main() {
    try {
        configService.init();
        applyAppSettings(configService.getConfig());
        soundService.init(configService);
        learningPathService.init();
        historyService.init();
        gamificationService.init();
        stateService.initState();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js');
            });
        }

        renderSidebar(document.getElementById('sidebar'));

        window.addEventListener('hashchange', handleRouteChange);
        window.addEventListener('settings-changed', (e) => applyAppSettings(e.detail));
        window.addEventListener('achievement-unlocked', () => {
            soundService.playSound('achievement');
        });

        document.body.addEventListener('click', (event) => {
            if (event.target.closest('.btn, .sidebar-link, .topic-button, .option-btn, .flashcard, .topic-card')) {
                soundService.playSound('click');
            }
        });
        
        document.body.addEventListener('mouseover', (event) => {
            const target = event.target;
            if (target.closest('.btn:not(:disabled), .sidebar-link, .topic-card, .level-card:not(.locked), .chapter-card:not(.locked), .flashcard')) {
                soundService.playSound('hover');
            }
        });

        const offlineIndicator = document.getElementById('offline-indicator');
        function updateOnlineStatus() {
            if (offlineIndicator) {
                if (navigator.onLine) {
                    offlineIndicator.style.display = 'none';
                } else {
                    offlineIndicator.style.display = 'block';
                }
            }
        }
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        handleRouteChange();

        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            const onTransitionEnd = () => {
                splashScreen.remove();
                const hasBeenWelcomed = localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED);
                if (!hasBeenWelcomed) {
                    showWelcomeScreen();
                }
            };
            splashScreen.addEventListener('transitionend', onTransitionEnd, { once: true });
            splashScreen.classList.add('hidden');
            
            setTimeout(() => {
                if (document.body.contains(splashScreen)) {
                     onTransitionEnd();
                }
            }, 600);
        }

    } catch (error) {
        console.error("A critical error occurred during application startup:", error);
        showFatalError(error);
    }
}

main();