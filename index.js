// index.js - Safe Bootloader v25.0
// We use dynamic imports for EVERYTHING to ensure this script body always runs.

const AppRefs = {
    firebase: null,
    constants: null,
    authModule: null,
    currentModule: null
};

// --- DOM UTILS ---
function getElement(id) { return document.getElementById(id); }

function removeSplashScreen() {
    const splash = getElement('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
        setTimeout(() => {
            if (splash.parentNode) splash.parentNode.removeChild(splash);
            window.APP_STATUS.booted = true;
            
            // Show welcome if needed
            const constants = AppRefs.constants;
            if (constants && getElement('app-wrapper').style.display !== 'none' && !localStorage.getItem(constants.LOCAL_STORAGE_KEYS.WELCOME_COMPLETED)) {
                showWelcomeScreen(constants);
            }
        }, 600);
    } else {
        window.APP_STATUS.booted = true;
    }
}

function showWelcomeScreen(constants) {
    const screen = getElement('welcome-screen');
    const btn = getElement('welcome-get-started-btn');
    if (screen && btn) {
        screen.style.display = 'flex';
        requestAnimationFrame(() => screen.classList.add('visible'));
        btn.onclick = () => {
            localStorage.setItem(constants.LOCAL_STORAGE_KEYS.WELCOME_COMPLETED, 'true');
            screen.classList.remove('visible');
            setTimeout(() => screen.remove(), 500);
        };
    }
}

// --- BOOT PROCESS ---

async function bootstrap() {
    console.log("System: Booting v25.0...");
    
    try {
        // Step 1: Load Constants (Safe Local)
        try {
            AppRefs.constants = await import('./constants.js');
        } catch (e) {
            throw new Error("Failed to load application constants. Please refresh.");
        }
        const { ROUTES } = AppRefs.constants;

        // Step 2: Load Firebase (External - May fail if offline/blocked)
        let firebaseLoaded = false;
        try {
            console.log("System: Loading Firebase...");
            AppRefs.firebase = await import('./services/firebaseService.js');
            firebaseLoaded = true;
        } catch (fbError) {
            console.warn("Firebase load failed (Offline or Blocked):", fbError);
            // We continue, but services relying on Firebase will degrade gracefully
        }

        // Step 3: Setup Auth Listener
        if (firebaseLoaded && AppRefs.firebase && AppRefs.firebase.onAuthChange) {
            console.log("System: Connecting to Identity Service...");
            AppRefs.firebase.onAuthChange(async (user) => {
                if (user) {
                    await transitionToApp(user);
                } else {
                    await transitionToAuth();
                }
            });
        } else {
            // Fallback for extreme failure -> Auth UI (Guest Mode force)
            console.warn("System: Identity Service Unavailable. Attempting fallback.");
            await transitionToAuth();
        }

        // Step 4: Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('SW Registered:', reg.scope);
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New content available; please refresh.');
                        }
                    };
                };
            }).catch(e => console.warn('SW failed:', e));
        }

    } catch (fatalError) {
        // If we catch here, it means we couldn't even load constants
        window.showFatalError("Startup Failed", fatalError.message);
    }
}

async function transitionToAuth() {
    console.log("System: Loading Auth Module...");
    getElement('app-wrapper').style.display = 'none';
    const authContainer = getElement('auth-container');
    authContainer.style.display = 'block';

    try {
        if (!AppRefs.authModule) {
            AppRefs.authModule = await import('./modules/auth/auth.js');
        }
        await AppRefs.authModule.init();
        removeSplashScreen();
    } catch (e) {
        console.error(e);
        window.showFatalError("Auth Module Error", "Failed to load authentication interface.\n" + e.message);
    }
}

async function transitionToApp(user) {
    console.log("System: Loading Application Core...");
    getElement('auth-container').style.display = 'none';
    getElement('app-wrapper').style.display = 'flex';

    if (AppRefs.authModule) {
        try { AppRefs.authModule.destroy(); } catch(e){}
    }

    try {
        // Load Core Services in parallel
        const [
            configSvc, sidebarSvc, historySvc, gamificationSvc, 
            learningPathSvc, soundSvc, stateSvc, themeSvc, voiceSvc
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

        // Initialize State
        configSvc.init();
        stateSvc.initState();
        themeSvc.applyTheme(configSvc.getConfig().theme);
        
        // Initialize Business Logic
        historySvc.init();
        gamificationSvc.init();
        learningPathSvc.init(); 
        soundSvc.init(configSvc);
        
        // Render UI
        const sidebarEl = getElement('sidebar');
        if (sidebarEl) sidebarSvc.renderSidebar(sidebarEl);

        // Voice (Lazy)
        setTimeout(() => voiceSvc.init(), 2000);
        
        const micBtn = getElement('voice-mic-btn');
        if (micBtn) {
            micBtn.onclick = () => {
                voiceSvc.toggleListening();
                micBtn.classList.toggle('active');
            };
        }

        // Setup Router
        setupRouter(AppRefs.constants.ROUTES);

    } catch (e) {
        console.error("App Init Error:", e);
        window.showFatalError("Core Service Failure", "The application core failed to load. " + e.message);
    } finally {
        removeSplashScreen();
    }
}

// --- ROUTER ---
function setupRouter(routes) {
    const handleHashChange = () => {
        const hash = window.location.hash.slice(1) || '/';
        let route = routes.find(r => r.path === hash);
        
        // Dynamic route matching
        if (!route) {
            const dynamicRoute = routes.find(r => r.path.includes(':'));
            if (dynamicRoute) {
                const base = dynamicRoute.path.split('/:')[0];
                if (hash.startsWith(base)) {
                    route = dynamicRoute;
                }
            }
        }

        if (!route) route = routes.find(r => r.path === '/');
        loadModule(route);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial load
}

async function loadModule(route) {
    const appContainer = getElement('app');
    if (!appContainer) return;

    // Cleanup previous module
    if (AppRefs.currentModule && AppRefs.currentModule.destroy) {
        try { AppRefs.currentModule.destroy(); } catch (e) { console.warn("Module destroy error", e); }
    }

    try {
        appContainer.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div>';
        
        const basePath = `./modules/${route.module}/${route.module}`;
        
        // Parallel fetch of assets
        const [html, css, jsModule] = await Promise.all([
            fetch(`${basePath}.html`).then(r => { if(!r.ok) throw new Error("HTML 404"); return r.text(); }),
            fetch(`${basePath}.css`).then(r => { if(!r.ok) throw new Error("CSS 404"); return r.text(); }),
            import(`${basePath}.js`)
        ]);

        // Inject CSS
        let styleTag = getElement('module-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'module-style';
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = css;

        // Render HTML
        appContainer.innerHTML = html;
        
        // Full bleed check
        const containerEl = getElement('app-container');
        if (containerEl) {
            containerEl.scrollTop = 0;
            if (route.fullBleed) containerEl.classList.add('full-bleed-container');
            else containerEl.classList.remove('full-bleed-container');
        }

        // Init JS
        AppRefs.currentModule = jsModule;
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
            <h3>Navigational Error</h3><p>Could not load destination: ${route.name}</p>
        </div>`;
    }
}

// Start
bootstrap();