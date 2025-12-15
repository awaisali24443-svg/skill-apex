
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
    // 1. Manage Voice FAB Visibility
    const fab = document.getElementById('voice-mic-btn');
    if (fab) {
        // Hide FAB on immersive routes where it conflicts with other mic buttons or gameplay
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

    // 2. Manage Full Bleed Layouts
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
    
    // Defer preloading slightly to let main thread breathe
    setTimeout(async () => {
        for (const moduleName of modulesToPreload) {
            try {
                await Promise.all([
                    fetch(`./modules/${moduleName}/${moduleName}.html`).then(res => res.text()),
                    fetch(`./modules/${moduleName}/${moduleName}.css`).then(res => res.text()),
                    import(`./modules/${moduleName}/${moduleName}.js`)
                ]);
            } catch (e) {
                // Ignore errors in background preload
            }
        }
        console.log('Modules preloaded.');
    }, 1000);
}

// --- ROBUST NETWORK MONITORING ---
function updateNetworkStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    if (!offlineIndicator) return;

    if (navigator.onLine) {
        offlineIndicator.style.display = 'none';
        // Only show toast if we were previously offline
        if (offlineIndicator.dataset.wasOffline === 'true') {
            showToast('Connection restored. System Online.', 'success');
            offlineIndicator.dataset.wasOffline = 'false';
        }
    } else {
        offlineIndicator.style.display = 'flex';
        offlineIndicator.dataset.wasOffline = 'true';
        showToast('Connection lost. Switching to Offline Protocol.', 'info');
    }
}

// --- APP INITIALIZATION ---
function initializeAppContent(user) {
    const splashScreen = document.getElementById('splash-screen');
    
    // 1. Critical UI Render (Immediate)
    stateService.initState();
    const sidebarEl = document.getElementById('sidebar');
    renderSidebar(sidebarEl);
    
    // 2. Start Router (Immediate)
    handleRouteChange();

    // 3. Defer Heavy/Network Services
    // We use requestIdleCallback or setTimeout to allow the UI to paint first
    const deferInit = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
    
    deferInit(() => {
        learningPathService.init();
        historyService.init();
        gamificationService.init();
        initVoice();
        backgroundService.init(); // Heavy canvas, defer it!
    });

    // 4. Setup Listeners
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('settings-changed', (e) => applyAppSettings(e.detail));
    window.addEventListener('achievement-unlocked', () => soundService.playSound('achievement'));
    window.addEventListener('level-up', (e) => showLevelUpModal(e.detail.level));
    
    const voiceToggleBtn = document.getElementById('voice-mic-btn');
    if (voiceToggleBtn) {
        if (!isVoiceSupported()) {
            voiceToggleBtn.style.display = 'none';
        }
        voiceToggleBtn.addEventListener('click', () => {
            toggleListening();
            voiceToggleBtn.classList.toggle('active');
        });
    }
    
    // Global Click Sound
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

    // 5. Hide Splash / Auth Overlay
    authModule.destroy(); // Remove auth UI if it exists
    document.getElementById('app-wrapper').style.display = 'flex'; // Show App
    document.getElementById('auth-container').style.display = 'none';

    if (splashScreen && !splashScreen.classList.contains('hidden')) {
        splashScreen.classList.add('hidden');
        
        const onTransitionEnd = () => {
            splashScreen.style.display = 'none'; // Ensure it's out of layout
            const hasBeenWelcomed = localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED);
            if (!hasBeenWelcomed) {
                showWelcomeScreen();
            }
            preloadCriticalModules();
        };
        
        splashScreen.addEventListener('transitionend', onTransitionEnd, { once: true });
        // Faster fallback to prevent hanging splash
        setTimeout(onTransitionEnd, 400); 
    }
}

function showAuthScreen() {
    const splashScreen = document.getElementById('splash-screen');
    
    if (splashScreen && !splashScreen.classList.contains('hidden')) {
        splashScreen.classList.add('hidden');
        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
        }, { once: true });
    }
    
    document.getElementById('app-wrapper').style.display = 'none'; 
    document.getElementById('auth-container').style.display = 'flex';
    
    authModule.init(); 
    
    // Defer background for Auth too
    setTimeout(() => {
        backgroundService.init(); 
    }, 200);
}

async function main() {
    try {
        configService.init();
        applyAppSettings(configService.getConfig());
        soundService.init(configService);

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js');
            });
        }
        
        // Network Listeners
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus(); 

        // --- WAIT FOR AUTH ---
        firebaseService.onAuthChange((user) => {
            if (user) {
                console.log('User authenticated:', user.email);
                initializeAppContent(user);
            } else {
                console.log('No user. Showing Auth screen.');
                showAuthScreen();
            }
        });

    } catch (error) {
        console.error("A critical error occurred during application startup:", error);
        showFatalError(error);
    }
}

window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global Error Caught:", message, error);
    return false; 
};

main();
