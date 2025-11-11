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

function handleFabClick(e) {
    const fab = e.target.closest('.module-fab');
    if (!fab) return;

    const moduleHash = fab.dataset.module;
    const moduleConfig = ROUTES.find(r => r.hash === moduleHash);
    if (moduleConfig) {
        soundService.playSound('click');
        loadModuleContent(moduleConfig);
    }
}

// --- Public API ---

async function show(moduleConfig, globalAppState) {
    if (!overlay) return;
    
    if (globalAppState) {
        appStateRef = globalAppState;
    }
    
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
            <style></style> <!-- Style tag for module-specific CSS -->
            <div class="module-panel">
                <div class="module-panel-header">
                    <h2>${moduleConfig.name}</h2>
                    <button class="back-to-galaxy-btn" title="Back to Galaxy">&times;</button>
                </div>
                <div class="module-panel-body">${html}</div>
                <div class="module-fab-container">
                    <button class="module-fab" data-module="profile" title="Profile">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>
                    </button>
                    <button class="module-fab" data-module="settings" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59-1.69.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"></path></svg>
                    </button>
                </div>
            </div>
        `;
        
        overlay.querySelector('style').textContent = css;

        if (typeof js.init === 'function') {
            await js.init(appStateRef);
        }

        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);
        overlay.querySelector('.module-fab-container').addEventListener('click', handleFabClick);
        
        overlay.classList.add('visible');

    } catch (error) {
        console.error("Failed to show module overlay:", error);
        overlay.innerHTML = `<div class="module-panel"><p>Error loading module.</p><button class="back-to-galaxy-btn">&times;</button></div>`;
        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);
        overlay.classList.add('visible');
    }
}

function hide() {
    overlay.classList.remove('visible');

    setTimeout(() => {
        if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
            currentModule.instance.destroy();
        }
        overlay.innerHTML = '';
        currentModule = null;
        appStateRef = null;
        
        // Let the home module know the overlay is closed
        window.dispatchEvent(new CustomEvent('close-module-view'));

    }, 400); // Match CSS transition duration
}

export const overlayService = {
    show,
    hide,
};
