/*
    GLOBAL SCRIPT
    This file handles routing, theme switching, and loading shared components.
*/
import '/scripts/themeSwitcher.js'; // Initializes the entire theme system

const rootContainer = document.getElementById('root-container');
const headerContainer = document.getElementById('header-container');
const yearSpan = document.getElementById('year');

const routes = {
    '': 'welcome', // Default route
    '#welcome': 'welcome',
    '#login': 'login',
    '#home': 'home', // Replaced main-home
    '#optional-quiz': 'optional-quiz-generator',
    '#programming-quiz': 'programming-quiz',
    '#historical-knowledge': 'historical-knowledge',
    '#loading': 'loading',
    '#quiz': 'quiz', // New quiz module
    '#results': 'results', // New results module
    '#screen': 'screen',
    '#settings': 'settings'
};

let isNavigating = false;

async function loadModule(moduleName) {
    if (!rootContainer || isNavigating) return;
    isNavigating = true;

    rootContainer.classList.add('module-exit');
    
    // Wait for fade out
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        const response = await fetch(`/modules/${moduleName}/${moduleName}.html`);
        if (!response.ok) throw new Error(`Module ${moduleName}.html not found.`);
        
        const html = await response.text();
        rootContainer.innerHTML = html;
        rootContainer.classList.remove('module-exit');
        rootContainer.classList.add('module-enter');

        // Clean up old module-specific assets
        document.getElementById('module-style')?.remove();
        document.getElementById('module-script')?.remove();

        // Add new module assets
        const style = document.createElement('link');
        style.id = 'module-style';
        style.rel = 'stylesheet';
        style.href = `/modules/${moduleName}/${moduleName}.css`;
        
        style.onload = () => {
             setTimeout(() => {
                rootContainer.classList.remove('module-enter');
                isNavigating = false;
            }, 300);
        };
        style.onerror = () => {
            console.error(`Failed to load stylesheet for ${moduleName}.`);
            rootContainer.classList.remove('module-enter');
            isNavigating = false;
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
        rootContainer.classList.remove('module-exit', 'module-enter');
        isNavigating = false;
    }
}

function handleRouteChange() {
    const hash = window.location.hash || '#welcome';
    const moduleName = routes[hash] || 'welcome'; // Fallback
    loadModule(moduleName);
}

async function loadHeader() {
    try {
        const response = await fetch('/global/header.html');
        if (!response.ok) throw new Error('Header template not found.');
        headerContainer.innerHTML = await response.text();
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