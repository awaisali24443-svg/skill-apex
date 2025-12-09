import { ROUTES, LOCAL_STORAGE_KEYS } from './constants.js';

// --- BOOTSTRAPPER STATE ---
// We hold references here since we don't static import services to prevent race conditions
const AppRefs = {
    firebase: null,
    config: null,
    sidebar: null,
    error: null,
    moduleCache: new Map(),
    currentModule: null,
    currentNavId: 0,
    authModule: null
};

// --- CORE UTILITIES (Defined locally to avoid import dependencies) ---

function getElement(id) { return document.getElementById(id); }

function removeSplashScreen() {
    const splash = getElement('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
        setTimeout(() => {
            if (splash.parentNode) splash.parentNode.removeChild(splash);
            // Show welcome if first time and we are NOT on auth screen
            if (getElement('app-wrapper').style.display !== 'none' && !localStorage.getItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED)) {
                showWelcomeScreen();
            }
        }, 600);
    }
    // Signal to failsafe that we made it
    window.APP_STATUS.booted = true;
}

function showWelcomeScreen() {
    const screen = getElement('welcome-screen');
    const btn = getElement('welcome-get-started-btn');
    if (screen && btn) {
        screen.style.display = 'flex';
        requestAnimationFrame(() => screen.classList.add('visible'));
        btn.onclick = () => {
            localStorage.setItem(LOCAL_STORAGE_KEYS.WELCOME_COMPLETED, 'true');
            screen.classList.remove('visible');
            setTimeout(() => screen.remove(), 500);
        };
    }
}

// --- MODULE LOADER ---

async function loadModule(route) {
    const appContainer = getElement('app');
    if (!appContainer) return;

    const navId = ++AppRefs.currentNavId;

    // Cleanup previous
    if (AppRefs.currentModule && AppRefs.currentModule.js && AppRefs.currentModule.js.destroy) {
        try { AppRefs.currentModule.js.destroy(); } catch (e) { console.warn("Module destroy error", e); }
    }

    try {
        // Fetch Module Assets
        const basePath = `./modules/${route.module}/${route.module}`;
        const [html, css, jsModule] = await Promise.all([
            fetch(`${basePath}.html`).then(r => { if(!r.ok) throw new Error("HTML 404"); return r.text(); }),
            fetch(`${basePath}.css`).then(r => { if(!r.ok) throw new Error("CSS 404"); return r.text(); }),
            import(`${basePath}.js`)
        ]);

        if (navId !== AppRefs.currentNavId) return; // Stale navigation

        // Update CSS
        let styleTag = getElement('module-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'module-style';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = css;

        // Render HTML
        appContainer.innerHTML = html;
        const containerEl = getElement('app-container');
        if (containerEl) {
            containerEl.scrollTop = 0;
            if (route.fullBleed) containerEl.classList.add('full-bleed-container');
            else containerEl.classList.remove('full-bleed-container');
        }

        // Init Logic
        AppRefs.currentModule = { js: jsModule };
        if (jsModule.init) await jsModule.init();

        // Update Sidebar Active State
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href && href.slice(1) === route.path) link.classList.add('active');
        });

    } catch (e) {
        console.error(`Failed to load module ${route.module}:`, e);
        appContainer.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:#ef4444;">
            <h3>Module Load Error</h3><p>${e.message}</p>
        </div>`;
    }
}

function router() {
    const hash = window.location.hash.slice(1) || '/';
    let route = ROUTES.find(r => r.path === hash);
    
    // Simple parameterized route matching
    if (!route) {
        // Find route with :param
        const dynamicRoute = ROUTES.find(r => r.path.includes(':'));
        if (dynamicRoute) {
            const base = dynamicRoute.path.split('/:')[0];
            if (hash.startsWith(base)) {
                route = dynamicRoute;
                // We'd parse params here if needed, usually passed via StateService
            }
        }
    }

    if (!route) route = ROUTES.find(r => r.path === '/'); // Default to home
    
    loadModule(route);
}

// --- INITIALIZATION ---

async function transitionToAuth() {
    console.log("Boot: Transitioning to Auth");
    getElement('app-wrapper').style.display = 'none';
    const authContainer = getElement('auth-container');
    authContainer.style.display = 'block';

    if (!AppRefs.authModule) {
        try {
            AppRefs.authModule = await import('./modules/auth/auth.js');
        } catch (e) {
            console.error("Failed to load Auth module", e);
            throw new Error("Could not load authentication system.");
        }
    }
    
    await AppRefs.authModule.init();
    removeSplashScreen();
}

async function transitionToApp(user) {
    console.log("Boot: Transitioning to App");
    getElement('auth-container').style.display = 'none';
    getElement('app-wrapper').style.display = 'flex';

    if (AppRefs.authModule) AppRefs.authModule.destroy();

    try {
        // Load Core Services Parallel (Dynamic Import for safety)
        const [
            configSvc,
            sidebarSvc,
            historySvc,
            gamificationSvc,
            learningPathSvc,
            soundSvc,
            stateSvc,
            themeSvc,
            voiceSvc
        ] = await Promise.all([
            import('./services/configService.js'),
            import('./services/sidebarService.js'),
            import('./services/historyService.js'),
            import('./services/gamificationService.js'),
            import('./services/learningPathService.js'),
            import('./services/soundService.js'),
            import('./services/stateService.js'),
            import('./services/themeService.js'),
            import('./services/voiceCommandService.js')
        ]);

        AppRefs.config = configSvc;
        AppRefs.sidebar = sidebarSvc;

        // Initialize Services
        configSvc.init();
        stateSvc.initState();
        themeSvc.applyTheme(configSvc.getConfig().theme);
        
        historySvc.init();
        gamificationSvc.init();
        learningPathSvc.init(); 
        soundSvc.init(configSvc);
        
        // Render Sidebar
        const sidebarEl = getElement('sidebar');
        if (sidebarEl) sidebarSvc.renderSidebar(sidebarEl);

        // Voice Init (Lazy load)
        setTimeout(() => voiceSvc.init(), 2000);
        const micBtn = getElement('voice-mic-btn');
        if (micBtn) {
            micBtn.onclick = () => {
                voiceSvc.toggleListening();
                micBtn.classList.toggle('active');
            };
        }

        // Start Router
        window.addEventListener('hashchange', router);
        router(); // Initial Route

    } catch (e) {
        console.error("App Transition Failed", e);
        throw new Error("Failed to start application services: " + e.message);
    } finally {
        removeSplashScreen();
    }
}

// --- BOOT ENTRY POINT ---
async function bootstrap() {
    try {
        window.APP_STATUS.jsLoaded = true;
        console.log("Boot: Starting...");

        // 1. Dynamic Import Firebase
        // This isolates the CDN dependency so index.js parses successfully even if CDN is down.
        try {
            AppRefs.firebase = await import('./services/firebaseService.js');
        } catch (e) {
            console.error("Firebase Import Error:", e);
            throw new Error("Could not connect to Cloud Services (Firebase). Check internet connection.");
        }

        // 2. Setup Auth Listener
        console.log("Boot: Listening for Auth");
        AppRefs.firebase.onAuthChange(user => {
            if (user) {
                transitionToApp(user);
            } else {
                transitionToAuth();
            }
        });

        // 3. Register Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed:', e));
            });
        }

    } catch (fatalError) {
        window.showFatalError("Startup Failed", fatalError.message);
    }
}

// Ignite
bootstrap();