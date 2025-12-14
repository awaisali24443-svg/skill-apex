
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
import { init as initVoice, isSupported as isVoiceSupported } from './services/voiceCommandService.js';
import * as backgroundService from './services/backgroundService.js';
import * as authModule from './modules/auth/auth.js';
import { showToast } from './services/toastService.js';

let isAppInitialized = false; 
const moduleCache = new Map();
let currentModule = null;

// --- MODULE LOADER ---
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
        throw new Error(`Module ${moduleName} failed to load. Check network.`);
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
        fab.style.opacity = shouldHide ? '0' : '1';
        fab.style.pointerEvents = shouldHide ? 'none' : 'auto';
    }
    const container = document.getElementById('app-container');
    if (container) {
        container.classList.toggle('full-bleed-container', !!route.fullBleed);
    }
}

async function loadModule(route) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // Cleanup previous module
    if (currentModule && currentModule.js.destroy) {
        try { currentModule.js.destroy(); } catch (e) { console.warn(e); }
    }

    try {
        stateService.setCurrentRoute(route);
        updateGlobalUI(route); 

        const moduleData = await fetchModule(route.module);
        currentModule = moduleData;

        // Apply CSS
        let styleTag = document.getElementById('module-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'module-style';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = moduleData.css;

        // Apply HTML
        appContainer.innerHTML = moduleData.html;

        // Init JS
        if (moduleData.js.init) await moduleData.js.init();
        
        // Update Sidebar
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
            const linkPath = link.getAttribute('href')?.slice(1) || '';
            if (route.path.startsWith(linkPath) && (linkPath !== '/' || route.path === '/')) {
                link.classList.add('active');
            }
        });
        
        document.getElementById('app-container').scrollTop = 0;

    } catch (error) {
        console.error("Module Load Error:", error);
        appContainer.innerHTML = `<div class="card" style="padding:2rem;text-align:center;">
            <h2>System Error</h2>
            <p>${error.message}</p>
            <button onclick="window.location.reload()" class="btn btn-primary">Reload System</button>
        </div>`;
    }
}

function handleRouteChange() {
    const path = window.location.hash.slice(1) || '/';
    const route = matchRoute(path);
    if (route) loadModule(route);
    else loadModule(ROUTES.find(r => r.path === '/'));
}

function applyAppSettings(config) {
    themeService.applyTheme(config.theme);
    themeService.applyAnimationSetting(config.animationIntensity);
}

function showWelcomeScreen() {
    // Only show if element exists (might be removed in future HTML versions)
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
        setTimeout(() => welcomeScreen.classList.add('visible'), 10);
    }
}

function updateNetworkStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;
    offlineIndicator.style.display = navigator.onLine ? 'none' : 'flex';
}

// --- BOOTSTRAP ---
function initializeAppContent(user) {
    if (isAppInitialized) return;
    isAppInitialized = true;
    console.log("Initializing App Content...");

    stateService.initState();
    renderSidebar(document.getElementById('sidebar'));
    handleRouteChange();

    // Defer heavy non-critical services
    setTimeout(() => {
        learningPathService.init();
        historyService.init();
        gamificationService.init();
        initVoice();
        backgroundService.init();
    }, 50);

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('settings-changed', (e) => applyAppSettings(e.detail));
    
    // Switch Views
    authModule.destroy();
    document.getElementById('app-wrapper').style.display = 'flex'; 
    document.getElementById('auth-container').style.display = 'none';

    // Remove Splash
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
            if (!localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED)) showWelcomeScreen();
        }, 500);
    }
}

function showAuthScreen() {
    if (isAppInitialized) return;
    console.log("Showing Auth Screen...");
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
    }
    document.getElementById('app-wrapper').style.display = 'none'; 
    document.getElementById('auth-container').style.display = 'flex';
    authModule.init(); 
    setTimeout(() => backgroundService.init(), 200);
}

// Emergency Global Reset
window.hardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    if(navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
};

async function main() {
    try {
        console.log("--- SYSTEM INIT ---");
        configService.init();
        applyAppSettings(configService.getConfig());
        soundService.init(configService);

        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log("SW Registered"))
                .catch(e => console.warn("SW Error:", e));
        }
        
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus(); 

        // TIMEOUT: If Auth takes > 2.5s, assume offline/guest needed
        const failsafeTimeout = setTimeout(() => {
            if (!isAppInitialized && !document.getElementById('auth-container').innerHTML) {
                console.warn("Auth Timeout. Enabling Guest Protocol.");
                firebaseService.enableSimulationMode();
                initializeAppContent({ isAnonymous: true });
            }
        }, 2500); 

        try {
            firebaseService.onAuthChange((user) => {
                clearTimeout(failsafeTimeout);
                if (user) initializeAppContent(user);
                else showAuthScreen();
            });
        } catch (fbError) {
            console.error("Auth Init Error:", fbError);
            clearTimeout(failsafeTimeout);
            firebaseService.enableSimulationMode();
            initializeAppContent({ isAnonymous: true });
        }

    } catch (error) {
        console.error("Critical Main Error:", error);
        showFatalError(error);
        const btn = document.getElementById('emergency-reset-btn');
        if(btn) btn.style.display = 'block';
    }
}

main();
