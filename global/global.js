import { ROUTES } from '../constants.js';

const app = document.getElementById('app');
const headerContainer = document.getElementById('header-container');
const splashScreen = document.getElementById('splash-screen');
let currentModule = null;

// --- STATE MANAGEMENT ---
// A simple global state to pass information between modules if needed
const appState = {
    context: null,
};

// --- MODULE LOADER ---
async function loadModule(moduleName, context = {}) {
    console.log(`Loading module: ${moduleName} with context:`, context);
    
    // Cleanup previous module's styles and scripts
    if (currentModule && currentModule.cleanup) {
        currentModule.cleanup();
    }
    
    app.innerHTML = ''; // Clear previous content

    const modulePath = `../modules/${moduleName}/${moduleName}`;
    const htmlPath = `${modulePath}.html`;
    const cssPath = `${modulePath}.css`;
    const jsPath = `${modulePath}.js`;

    try {
        // 1. Fetch HTML
        const htmlRes = await fetch(htmlPath);
        if (!htmlRes.ok) throw new Error(`Failed to load HTML for ${moduleName}`);
        app.innerHTML = await htmlRes.text();

        // 2. Load CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssPath;
        cssLink.id = `style-${moduleName}`;
        document.head.appendChild(cssLink);
        
        // 3. Load and execute JS
        const module = await import(jsPath);
        if (module.init) {
            appState.context = context;
            module.init(appState);
        }

        // Store cleanup function
        currentModule = {
            name: moduleName,
            cleanup: () => {
                document.getElementById(`style-${moduleName}`)?.remove();
                if (module.destroy) {
                    module.destroy();
                }
            }
        };

    } catch (error) {
        console.error(`Error loading module ${moduleName}:`, error);
        app.innerHTML = `<div class="error-container"><h2>Error</h2><p>Could not load the requested page. Please try again.</p><a href="#home" class="btn">Go Home</a></div>`;
    }
}


// --- ROUTER ---
function handleRouteChange() {
    const hash = window.location.hash || '#welcome';
    const path = hash.substring(1);
    
    const route = ROUTES[path] || ROUTES['home']; // Fallback to home
    
    loadModule(route.module, route.context || {});
}

// --- INITIALIZATION ---
async function init() {
    console.log("Initializing application...");
    
    // Load header
    try {
        const headerRes = await fetch('/global/header.html');
        headerContainer.innerHTML = await headerRes.text();
    } catch (error) {
        console.error("Failed to load header:", error);
    }

    // Set up routing
    window.addEventListener('hashchange', handleRouteChange);
    
    // Initial load
    handleRouteChange();
    
    // Hide splash screen after a delay
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
    }, 2500); // Let logo animation play
}

document.addEventListener('DOMContentLoaded', init);