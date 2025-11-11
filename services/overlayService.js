// services/overlayService.js
import { ROUTES } from '../constants.js';
import { soundService } from './soundService.js';

const overlay = document.getElementById('module-overlay');
const moduleCache = new Map();
let currentModule = null;
let appStateRef = null;

// --- Private Functions ---

async function loadModuleContent(moduleConfig) {
    if (!overlay || !appStateRef) return;

    // --- 1. Destroy the old module instance ---
    if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
        currentModule.instance.destroy();
    }

    // --- 2. Fetch new module assets ---
    const path = moduleConfig.module;
    if (!moduleCache.has(path)) {
        const [html, js] = await Promise.all([
            fetch(`/modules/${path}/${path}.html`).then(res => res.text()),
            import(`../modules/${path}/${path}.js`)
        ]);
        const cssRes = await fetch(`/modules/${path}/${path}.css`);
        const cssText = cssRes.ok ? await cssRes.text() : '';
        moduleCache.set(path, { html, css: cssText, js });
    }
    const { html, css, js } = moduleCache.get(path);
    currentModule = { ...moduleConfig, instance: js };

    // --- 3. Animate out old content ---
    const panelHeader = overlay.querySelector('.module-panel-header');
    const panelBody = overlay.querySelector('.module-panel-body');
    if (panelHeader) panelHeader.style.opacity = 0;
    if (panelBody) panelBody.style.opacity = 0;
    await new Promise(resolve => setTimeout(resolve, 200));

    // --- 4. Replace and initialize new content ---
    const styleTag = overlay.querySelector('style');
    if (styleTag) styleTag.textContent = css;
    
    const titleEl = overlay.querySelector('.module-panel-header h2');
    if(titleEl) titleEl.textContent = moduleConfig.name;

    if(panelBody) panelBody.innerHTML = html;
    
    if (typeof js.init === 'function') {
        await js.init(appStateRef);
    }

    // --- 5. Animate in new content ---
    if (panelHeader) panelHeader.style.opacity = 1;
    if (panelBody) panelBody.style.opacity = 1;
}


// --- Public API ---

async function show(moduleConfig, globalAppState) {
    if (!overlay) return;
    
    if (globalAppState) {
        appStateRef = globalAppState;
    }
    
    // If overlay is already visible but we're loading a new module
    if (overlay.classList.contains('visible')) {
        if (currentModule?.module !== moduleConfig.module) {
            await loadModuleContent(moduleConfig);
        }
        return;
    }
    
    try {
        const path = moduleConfig.module;
        if (!moduleCache.has(path)) {
            const [html, js] = await Promise.all([
                fetch(`/modules/${path}/${path}.html`).then(res => res.text()),
                import(`../modules/${path}/${path}.js`)
            ]);
            const cssRes = await fetch(`/modules/${path}/${path}.css`);
            const cssText = cssRes.ok ? await cssRes.text() : '';
            moduleCache.set(path, { html, css: cssText, js });
        }
        const { html, css, js } = moduleCache.get(path);
        currentModule = { ...moduleConfig, instance: js };

        overlay.innerHTML = `
            <style>${css}</style> <!-- Style tag for module-specific CSS -->
            <div class="module-panel">
                <div class="module-panel-header">
                    <h2>${moduleConfig.name}</h2>
                    <button class="back-to-galaxy-btn" title="Back to Galaxy">&times;</button>
                </div>
                <div class="module-panel-body">${html}</div>
            </div>
        `;
        
        if (typeof js.init === 'function') {
            await js.init(appStateRef);
        }

        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);
        
        overlay.classList.add('visible');

    } catch (error) {
        console.error("Failed to show module overlay:", error);
        overlay.innerHTML = `<div class="module-panel"><p>Error loading module.</p><button class="back-to-galaxy-btn">&times;</button></div>`;
        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);
        overlay.classList.add('visible');
    }
}

function hide() {
    if (!overlay.classList.contains('visible')) return;

    overlay.classList.remove('visible');

    // Let the home module know the overlay is closed immediately
    window.dispatchEvent(new CustomEvent('close-module-view'));

    setTimeout(() => {
        if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
            currentModule.instance.destroy();
        }
        overlay.innerHTML = '';
        currentModule = null;
        appStateRef = null;
    }, 400); // Match CSS transition duration
}

export const overlayService = {
    show,
    hide,
};