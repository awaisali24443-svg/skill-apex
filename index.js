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
import { init as initVoice, toggleListening } from './services/voiceCommandService.js';
import * as authModule from './modules/auth/auth.js';

// --- GLOBAL ERROR TRAP ---
window.onerror = function(msg, url, line, col, error) {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.innerHTML = `
            <div style="color:#ef4444; text-align:center; padding:40px; font-family:sans-serif;">
                <h3 style="margin-bottom:10px;">Startup Error</h3>
                <p style="opacity:0.8; margin-bottom:20px;">${msg}</p>
                <button onclick="window.location.reload()" style="padding:10px 20px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">Reload Application</button>
            </div>
        `;
    }
};

const moduleCache = new Map();
let currentModule = null;
let currentNavigationId = 0; // RACE CONDITION FIX: Track active navigation
let hasInitialized = false; // RACE CONDITION FIX: Prevent double init
let isAuthLock = false; // Lock to prevent auth screen / app screen fighting

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

    // RACE CONDITION FIX: Increment ID. If ID changes during await, abort.
    const navigationId = ++currentNavigationId;

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
            
            // 1. Fetch Module
            const moduleData = await fetchModule(route.module);
            
            // CRITICAL CHECK: Did the user navigate away while we were fetching?
            if (navigationId !== currentNavigationId) {
                console.log(`Navigation to ${route.module} aborted (stale).`);
                return;
            }

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

            // 2. Init Module
            if (moduleData.js.init) {
                await moduleData.js.init();
            }
            
            // Check again after init (some inits are async)
            if (navigationId !== currentNavigationId) return;
            
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
            if (navigationId !== currentNavigationId) return;
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
        document.startViewTransition(async () => {
             await renderNewModule();
        });
    } else {
        // Legacy Fade
        appContainer.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 200)); // Shortened fade for responsiveness
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

function showLevelUpModal(level) {
    soundService.playSound('achievement');
    const modal = document.createElement('div');
    modal.className = 'level-up-overlay';
    modal.innerHTML = `
        <div class="level-up-content">
            <div class="level-badge">${level}</div>
            <h2 class="level-up-title">LEVEL UP!</h2>
            <p class="level-up-sub">You've reached Level ${level}</p>
            <button id="level-up-continue" class="btn btn-primary">Continue</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('level-up-continue').addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 500);
    });
}

async function preloadCriticalModules() {
    const modulesToPreload = ['topic-list', 'game-map', 'game-level', 'quiz-review'];
    for (const moduleName of modulesToPreload) {
        try {
            await Promise.all([
                fetch(`./modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
                fetch(`./modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
                import(`./modules/${moduleName}/${moduleName}.js`)
            ]);
        } catch (e) {}
    }
}

function removeSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    if (!splashScreen || splashScreen.classList.contains('hidden')) return;

    const finalize = () => {
        if (splashScreen.parentNode) {
            splashScreen.parentNode.removeChild(splashScreen);
        }
        const hasBeenWelcomed = localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED);
        if (!hasBeenWelcomed && hasInitialized) { // Only show welcome if entered app
            showWelcomeScreen();
        }
        setTimeout(preloadCriticalModules, 200);
    };

    splashScreen.classList.add('hidden');
    splashScreen.style.pointerEvents = 'none';
    
    const safetyTimer = setTimeout(finalize, 600);
    splashScreen.addEventListener('transitionend', () => {
        clearTimeout(safetyTimer);
        finalize();
    }, { once: true });
}

// --- APP INITIALIZATION ---
function initializeAppContent(user) {
    if (hasInitialized || isAuthLock) return;
    hasInitialized = true;
    isAuthLock = true; // Lock further auth changes

    // 1. Initialize Services
    learningPathService.init();
    historyService.init();
    gamificationService.init();
    stateService.initState();
    setTimeout(initVoice, 2000); 

    // 2. Render App Shell
    const sidebarEl = document.getElementById('sidebar');
    renderSidebar(sidebarEl);
    
    const voiceToggleBtn = document.getElementById('voice-mic-btn');
    if (voiceToggleBtn) {
        voiceToggleBtn.addEventListener('click', () => {
            toggleListening();
            voiceToggleBtn.classList.toggle('active');
        });
    }

    // 3. Setup Listeners
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('settings-changed', (e) => applyAppSettings(e.detail));
    window.addEventListener('achievement-unlocked', () => soundService.playSound('achievement'));
    window.addEventListener('level-up', (e) => showLevelUpModal(e.detail.level));

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

    // 4. Start Router
    handleRouteChange();

    // 5. Switch Screens
    authModule.destroy(); 
    document.getElementById('app-wrapper').style.display = 'flex'; 
    document.getElementById('auth-container').style.display = 'none';

    removeSplashScreen();
}

async function showAuthScreen() {
    // CRITICAL RACE CONDITION FIX:
    if (hasInitialized || isAuthLock) return;
    isAuthLock = true; // Lock immediately to prevent double fetch

    try {
        // Load auth module
        await authModule.init(); 
        
        // SECOND CHECK: Did initialization happen somehow while we were awaiting?
        if (hasInitialized) {
            isAuthLock = false; // Reset lock if we aborted
            return;
        }

        document.getElementById('app-wrapper').style.display = 'none'; 
        document.getElementById('auth-container').style.display = 'flex';
        
        removeSplashScreen();
    } catch (e) {
        console.error("Critical Auth Load Error:", e);
        // Fallback: If auth fails to load, remove splash anyway so user isn't stuck on black screen
        // They will see a broken auth page, but at least the failsafe retry button will be visible or they can try reload
        removeSplashScreen();
    }
}

async function main() {
    try {
        setInterval(() => { fetch('/health').catch(() => {}); }, 5 * 60 * 1000);

        configService.init();
        applyAppSettings(configService.getConfig());
        soundService.init(configService);

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js');
            });
        }

        // RACE CONDITION FIX:
        // Firebase is fast, but network can be slow. 
        // We set a timeout to show the Auth screen if Firebase takes too long.
        
        const authTimeout = setTimeout(() => {
            if (!hasInitialized && !isAuthLock) {
                console.warn("Auth check timed out. Defaulting to Auth Screen.");
                showAuthScreen();
            }
        }, 3500);

        firebaseService.onAuthChange((user) => {
            clearTimeout(authTimeout);
            
            // If we are already locked into showing Auth screen or App, ignore later updates
            // (Unless it's a legitimate logout/login which refreshes page usually)
            if (isAuthLock && !user) return; 

            if (user) {
                // If user arrives late but we showed auth screen, we should switch to app
                // But simplified: reloading page on login handles this better.
                // For now, if we haven't init, init.
                if (!hasInitialized) {
                    isAuthLock = false; // Unlock to allow init
                    initializeAppContent(user);
                }
            } else {
                if (!hasInitialized && !isAuthLock) {
                    showAuthScreen();
                }
            }
        });

    } catch (error) {
        console.error("Critical startup error:", error);
        showFatalError(error);
    }
}

main();