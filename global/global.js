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
    '#historical-knowledge': 'historical-knowledge',
    '#loading': 'loading',
    '#screen': 'screen',
    '#settings': 'settings' // New route for the settings screen
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
        
        // Wait for styles to load before showing content to prevent FOUC
        style.onload = () => {
            rootContainer.style.opacity = '1';
        };
        style.onerror = () => {
            console.error(`Failed to load stylesheet for ${moduleName}.`);
            rootContainer.style.opacity = '1'; // Show content anyway
        };
        
        document.head.appendChild(style);

        const script = document.createElement('script');
        script.id = 'module-script';
        script.type = 'module';
        script.src = `/modules/${moduleName}/${moduleName}.js`;
        document.body.appendChild(script);

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

function setTheme(themeName) {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) {
        themeLink.href = `/themes/${themeName}.css`;
        localStorage.setItem('theme', themeName);
    }
}

async function loadHeader() {
    try {
        const response = await fetch('/global/header.html');
        if (!response.ok) throw new Error('Header template not found.');
        headerContainer.innerHTML = await response.text();
        
        const savedTheme = localStorage.getItem('theme') || 'carbon-mist';
        setTheme(savedTheme);

    } catch (error) {
        console.error('Error loading header:', error);
        headerContainer.innerHTML = '<p style="color:red; text-align:center;">Error loading header</p>';
    }
}

function init() {
    loadHeader();
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Initial load
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

init();