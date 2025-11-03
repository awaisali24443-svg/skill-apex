/*
    GLOBAL SCRIPT
    This file handles routing, theme switching, and loading shared components.
*/

const rootContainer = document.getElementById('root-container');
const headerContainer = document.getElementById('header-container');
const yearSpan = document.getElementById('year');

// --- Router ---
const routes = {
    '': 'home', // Default route
    '#home': 'home',
    '#login': 'login',
    '#signup': 'signup',
    '#optional-quiz': 'optional-quiz-generator',
    '#main': 'main'
};

async function loadModule(moduleName) {
    if (!rootContainer) return;
    rootContainer.classList.remove('fade-in');

    try {
        // Fetch HTML content of the module
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module ${moduleName} not found.`);
        const html = await response.text();
        rootContainer.innerHTML = html;
        rootContainer.classList.add('fade-in');


        // Remove old module script if it exists
        const oldScript = document.getElementById('module-script');
        if (oldScript) oldScript.remove();
        
        // Remove old module style if it exists
        const oldStyle = document.getElementById('module-style');
        if (oldStyle) oldStyle.remove();

        // Add new module style
        const style = document.createElement('link');
        style.id = 'module-style';
        style.rel = 'stylesheet';
        style.href = `/modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(style);

        // Add new module script
        const script = document.createElement('script');
        script.id = 'module-script';
        script.type = 'module';
        script.src = `/modules/${moduleName}/${moduleName}.js`;
        document.body.appendChild(script);

    } catch (error) {
        console.error('Error loading module:', error);
        rootContainer.innerHTML = `<div class="card"><h2 style="color:var(--color-danger);">Error: Could not load page.</h2><p>Please check the console for details.</p></div>`;
    }
}

function handleRouteChange() {
    const hash = window.location.hash || '#home';
    const moduleName = routes[hash] || 'home'; // Fallback to home
    loadModule(moduleName);
}

// --- Theme Switcher ---
function setTheme(themeName) {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) {
        themeLink.href = `/themes/${themeName}.css`;
        localStorage.setItem('theme', themeName);
    }
}

function setupThemeSwitcher() {
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        themeSelector.addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
        // Set initial value from localStorage
        const savedTheme = localStorage.getItem('theme') || 'dark';
        themeSelector.value = savedTheme;
    }
}

// --- Initializer ---
async function init() {
    // Load Header
    try {
        const response = await fetch('/global/header.html');
        headerContainer.innerHTML = await response.text();
        setupThemeSwitcher();
    } catch (error) {
        console.error("Failed to load header:", error);
    }
    
    // Set current year in footer
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Load initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // Listen for hash changes
    window.addEventListener('hashchange', handleRouteChange);
    
    // Initial route load
    handleRouteChange();

    // Keep the instance alive with a regular "weather check" ping to prevent it from sleeping
    setInterval(() => {
        console.log("Checking server weather... (pinging to keep alive)");
        fetch('/').catch(err => console.error('Server weather check failed; instance might be stormy:', err));
    }, 4 * 60 * 1000); // 4 minutes
}

// Start the application
init();