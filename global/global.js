/*
    GLOBAL SCRIPT
    This file handles routing, theme switching, and loading shared components.
*/

const rootContainer = document.getElementById('root-container');
const headerContainer = document.getElementById('header-container');
const yearSpan = document.getElementById('year');

const routes = {
    '': 'welcome', // Default route
    '#welcome': 'welcome',
    '#login': 'login',
    '#home': 'main-home',
    '#quiz': 'main', // AI Quiz Generator module
    '#optional-quiz': 'optional-quiz-generator',
    '#programming-quiz': 'programming-quiz',
    '#loading': 'loading'
};

async function loadModule(moduleName) {
    if (!rootContainer) return;
    rootContainer.style.opacity = '0';
    
    // Wait for fade out
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module ${moduleName}.html not found.`);
        
        const html = await response.text();
        rootContainer.innerHTML = html;

        // Clean up old module-specific assets
        document.getElementById('module-style')?.remove();
        document.getElementById('module-script')?.remove();

        // Add new module assets
        const style = document.createElement('link');
        style.id = 'module-style';
        style.rel = 'stylesheet';
        style.href = `/modules/${moduleName}/${moduleName}.css`;
        document.head.appendChild(style);

        const script = document.createElement('script');
        script.id = 'module-script';
        script.type = 'module';
        script.src = `/modules/${moduleName}/${moduleName}.js`;
        document.body.appendChild(script);

        rootContainer.style.opacity = '1';

    } catch (error) {
        console.error('Error loading module:', error);
        rootContainer.innerHTML = `<div class="card" style="text-align:center;"><h2 style="color:var(--color-danger);">Error: Could not load page.</h2><p>${error.message}</p></div>`;
        rootContainer.style.opacity = '1';
    }
}

function handleRouteChange() {
    const hash = window.location.hash || '#welcome';
    const moduleName = routes[hash] || 'welcome'; // Fallback
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
        const savedTheme = localStorage.getItem('theme') || 'carbon-mist';
        themeSelector.value = savedTheme;
        setTheme(savedTheme);

        themeSelector.addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
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
    
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    const savedTheme = localStorage.getItem('theme') || 'carbon-mist';
    setTheme(savedTheme);

    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange();
}

init();