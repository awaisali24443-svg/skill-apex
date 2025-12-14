
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
import * as firebaseService from './services/firebaseService.js';
import { init as initVoice, toggleListening, isSupported as isVoiceSupported } from './services/voiceCommandService.js';
import * as backgroundService from './services/backgroundService.js';
import * as authModule from './modules/auth/auth.js';
import { showToast } from './services/toastService.js';

const moduleCache = new Map();
let currentModule = null;
let isAppInitialized = false; // Prevent double init

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

function updateGlobalUI(route) {
    const fab = document.getElementById('voice-mic-btn');
    if (fab) {
        const immersiveModules = ['aural', 'game-level'];
        const shouldHide = immersiveModules.includes(route.module) || !isVoiceSupported();
        
        if (shouldHide) {
            fab.style.opacity = '0';
            fab.style.pointerEvents = 'none';
        } else {
            fab.style.opacity = '1';
            fab.style.pointerEvents = 'auto';
        }
    }

    const container = document.getElementById('app-container');
    if (container) {
        container.classList.toggle('full-bleed-container', !!route.fullBleed);
    }
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
            updateGlobalUI(route); 

            const moduleData = await fetchModule(route.module);
            currentModule = moduleData;

            appContainer.innerHTML = '';
            
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
            
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
                const linkPath = link.getAttribute('href')?.slice(1) || '';
                if (route.path.startsWith(linkPath) && (linkPath !== '/' || route.path === '/')) {
                    link.classList.add('active');
                }
            });
            
            document.getElementById('app-container').scrollTop = 0;

        } catch (error) {
            console.error("Failed to load module:", error);
            appContainer.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><h2>Module Error</h2><p>${error.message}</p><a href="#" class="btn">Home</a></div>`;
        }
    };

    if (document.startViewTransition) {
        document.startViewTransition(async () => await renderNewModule());
    } else {
        await renderNewModule();
    }
}

function handleRouteChange() {
    const path = window.location.hash.slice(1) || '/';
    const route = matchRoute(path);

    if (route) {
        loadModule(route);
    } else {
        const homeRoute = ROUTES.find(r => r.path === '/');
        if(homeRoute) loadModule(homeRoute);
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
        setTimeout(() => welcomeScreen.remove(), 500);
    }, { once: true });
}

function updateNetworkStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;

    if (navigator.onLine) {
        offlineIndicator.style.display = 'none';
    } else {
        offlineIndicator.style.display = 'flex';
        showToast('Offline Mode Active', 'info');
    }
}

function initializeAppContent(user) {
    if (isAppInitialized) return;
    isAppInitialized = true;

    const splashScreen = document.getElementById('splash-screen');
    
    stateService.initState();
    const sidebarEl = document.getElementById('sidebar');
    renderSidebar(sidebarEl);
    
    handleRouteChange();

    // Defer heavy services
    setTimeout(() => {
        learningPathService.init();
        historyService.init();
        gamificationService.init();
        initVoice();
        backgroundService.init(); 
    }, 50);

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('settings-changed', (e) => applyAppSettings(e.detail));
    
    // Hide Auth & Splash
    authModule.destroy();
    document.getElementById('app-wrapper').style.display = 'flex'; 
    document.getElementById('auth-container').style.display = 'none';

    if (splashScreen) {
        splashScreen.style.opacity = '0';
        setTimeout(() => {
            splashScreen.style.display = 'none';
            const hasBeenWelcomed = localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED);
            if (!hasBeenWelcomed) showWelcomeScreen();
        }, 500);
    }
}

function showAuthScreen() {
    if (isAppInitialized) return;
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        splashScreen.style.opacity = '0';
        setTimeout(() => splashScreen.style.display = 'none', 500);
    }
    document.getElementById('app-wrapper').style.display = 'none'; 
    document.getElementById('auth-container').style.display = 'flex';
    authModule.init(); 
    setTimeout(() => backgroundService.init(), 200);
}

// Emergency Manual Reset in console: window.hardReset()
window.hardReset = () => {
    console.log("TRIGGERING HARD RESET");
    localStorage.clear();
    sessionStorage.clear();
    
    if(navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            for(let registration of regs) {
                registration.unregister();
            }
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
};

async function main() {
    try {
        console.log("App Initializing...");
        configService.init();
        applyAppSettings(configService.getConfig());
        soundService.init(configService);

        // --- SERVICE WORKER ---
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(e => console.warn("SW Fail:", e));
        }
        
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus(); 

        // --- TIMEOUT FAILSAFE ---
        // If Firebase/Auth takes too long, force start as guest
        const failsafeTimeout = setTimeout(() => {
            if (!isAppInitialized && !document.getElementById('auth-container').innerHTML) {
                console.warn("Auth timed out. Forcing simulation mode.");
                firebaseService.enableSimulationMode();
                initializeAppContent({ isAnonymous: true });
            }
        }, 3500); // 3.5s timeout

        // --- FIREBASE AUTH ---
        // Wrap in try-catch in case firebaseService throws immediately
        try {
            firebaseService.onAuthChange((user) => {
                clearTimeout(failsafeTimeout);
                if (user) {
                    initializeAppContent(user);
                } else {
                    showAuthScreen();
                }
            });
        } catch (fbError) {
            console.error("Firebase Init Failed:", fbError);
            clearTimeout(failsafeTimeout);
            firebaseService.enableSimulationMode();
            initializeAppContent({ isAnonymous: true });
        }

    } catch (error) {
        console.error("Critical Error in Main:", error);
        showFatalError(error);
        // Ensure reset button is visible if main fails
        const btn = document.getElementById('emergency-reset-btn');
        if(btn) btn.style.display = 'block';
    }
}

main();
