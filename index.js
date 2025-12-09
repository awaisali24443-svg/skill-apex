
// index.js - Safe Bootloader v40.0
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
    console.log("System: Booting v40.0...");
    
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
        voiceSvc.init();

        // Render Sidebar
        sidebarSvc.renderSidebar(getElement('sidebar'));

        // Router
        setupRouter(ROUTES, stateSvc);

    } catch (e) {
        console.error("App Transition Error:", e);
        window.showFatalError("Core Service Failure", "The application core failed to load.\n" + e.message);
    }
}

function setupRouter(routes, stateSvc) {
    const handleHashChange = async () => {
        const hash = window.location.hash.slice(1) || '/';
        
        // Simple Route Matching
        let match = routes.find(r => r.path === hash);
        let params = {};

        // Dynamic Route Matching (e.g., /game/:topic)
        if (!match) {
            for (const r of routes) {
                if (r.path.includes(':')) {
                    const routeParts = r.path.split('/');
                    const hashParts = hash.split('/');
                    if (routeParts.length === hashParts.length) {
                        let isMatch = true;
                        let tempParams = {};
                        for (let i = 0; i < routeParts.length; i++) {
                            if (routeParts[i].startsWith(':')) {
                                tempParams[routeParts[i].slice(1)] = decodeURIComponent(hashParts[i]);
                            } else if (routeParts[i] !== hashParts[i]) {
                                isMatch = false;
                                break;
                            }
                        }
                        if (isMatch) {
                            match = r;
                            params = tempParams;
                            break;
                        }
                    }
                }
            }
        }

        if (match) {
            // Unload previous module if needed
            if (AppRefs.currentModule && AppRefs.currentModule.destroy) {
                try { AppRefs.currentModule.destroy(); } catch(e){}
            }

            // Update State
            match.params = params;
            stateSvc.setCurrentRoute(match);

            // Update UI Layout
            const appContainer = getElement('app-container');
            const sidebar = getElement('sidebar');
            
            if (match.fullBleed) {
                appContainer.classList.add('full-bleed');
                sidebar.classList.add('hidden');
            } else {
                appContainer.classList.remove('full-bleed');
                sidebar.classList.remove('hidden');
            }

            // Update Active Link
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${match.path}`) link.classList.add('active');
            });

            try {
                // Dynamic Import Module
                const modulePath = `./modules/${match.module}/${match.module}.js`;
                const htmlPath = `./modules/${match.module}/${match.module}.html`;
                const cssPath = `./modules/${match.module}/${match.module}.css`;

                // Load HTML
                const response = await fetch(htmlPath);
                if (!response.ok) throw new Error(`HTML Load Failed: ${htmlPath}`);
                const html = await response.text();
                getElement('app').innerHTML = html;

                // Load CSS (once)
                if (!document.querySelector(`link[href="${cssPath}"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = cssPath;
                    document.head.appendChild(link);
                }

                // Load JS
                const module = await import(modulePath);
                AppRefs.currentModule = module;
                if (module.init) await module.init();
                
                // Clear temp context after successful load
                stateSvc.clearNavigationContext();
                
                removeSplashScreen();

            } catch (e) {
                console.error("Route Error:", e);
                getElement('app').innerHTML = `<div class="error-state"><h2>Failed to load module</h2><p>${e.message}</p><button class="btn" onclick="window.location.reload()">Reload</button></div>`;
            }
        } else {
            // 404 - Redirect Home
            window.location.hash = '/';
        }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial load
}

// Start
bootstrap();