// services/overlayService.js
import { ROUTES } from '../constants.js';
import { soundService } from './soundService.js';

const overlay = document.getElementById('module-overlay');
const moduleCache = new Map();
let currentModule = null;
let appStateRef = null;

// --- Hexagon Transition Logic ---
let hexCanvas, hexCtx, hexAnimationId;
const hexGrid = {
    cols: 0,
    rows: 0,
    hexSize: 50,
    hexagons: []
};

function initHexGrid() {
    if (!hexCanvas) return;
    hexCanvas.width = window.innerWidth;
    hexCanvas.height = window.innerHeight;
    hexGrid.cols = Math.ceil(hexCanvas.width / (hexGrid.hexSize * 1.5)) + 1;
    hexGrid.rows = Math.ceil(hexCanvas.height / (hexGrid.hexSize * Math.sqrt(3))) + 1;
    hexGrid.hexagons = [];

    for (let row = 0; row < hexGrid.rows; row++) {
        for (let col = 0; col < hexGrid.cols; col++) {
            const x = col * hexGrid.hexSize * 1.5;
            const y = row * hexGrid.hexSize * Math.sqrt(3) + (col % 2) * (hexGrid.hexSize * Math.sqrt(3) / 2);
            const dist = Math.sqrt(Math.pow(x - hexCanvas.width / 2, 2) + Math.pow(y - hexCanvas.height / 2, 2));
            hexGrid.hexagons.push({ x, y, dist, scale: 0 });
        }
    }
}

function drawHexagon(x, y, size) {
    hexCtx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        hexCtx.lineTo(hx, hy);
    }
    hexCtx.closePath();
    hexCtx.fill();
}

function animateHexTransition(reveal = true) {
    if (!hexCtx) return;
    let startTime = null;
    const duration = 600; // ms

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);

        hexCtx.clearRect(0, 0, hexCanvas.width, hexCanvas.height);
        hexCtx.fillStyle = 'rgba(0, 246, 255, 0.8)';

        const maxDist = Math.sqrt(Math.pow(hexCanvas.width / 2, 2) + Math.pow(hexCanvas.height / 2, 2));

        hexGrid.hexagons.forEach(hex => {
            const revealStart = hex.dist / maxDist * 0.7; // Start revealing based on distance from center
            const hexProgress = Math.max(0, Math.min(1, (easedProgress - revealStart) / 0.3));

            if (reveal) {
                hex.scale = hexProgress;
            } else {
                hex.scale = 1 - hexProgress;
            }
            
            if (hex.scale > 0) {
                 drawHexagon(hex.x, hex.y, hexGrid.hexSize * hex.scale);
            }
        });

        if (progress < 1) {
            hexAnimationId = requestAnimationFrame(animate);
        } else {
            if (!reveal) {
                 overlay.innerHTML = ''; // Clean up after hiding
            }
        }
    }
    cancelAnimationFrame(hexAnimationId);
    requestAnimationFrame(animate);
}

// --- Private Functions ---

async function loadModuleContent(moduleConfig) {
    if (!overlay || !appStateRef) return;

    if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
        currentModule.instance.destroy();
    }

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

    const panel = overlay.querySelector('.module-panel');
    if (panel) panel.style.opacity = 0;
    await new Promise(resolve => setTimeout(resolve, 200));

    const styleTag = overlay.querySelector('style');
    if (styleTag) styleTag.textContent = css;
    
    const titleEl = overlay.querySelector('.module-panel-header h2');
    if(titleEl) titleEl.textContent = moduleConfig.name;

    const panelBody = overlay.querySelector('.module-panel-body');
    if(panelBody) panelBody.innerHTML = html;
    
    if (typeof js.init === 'function') {
        await js.init(appStateRef);
    }

    if (panel) panel.style.opacity = 1;
}


// --- Public API ---

async function show(moduleConfig, globalAppState) {
    if (!overlay) return;
    
    if (globalAppState) appStateRef = globalAppState;
    
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
            <canvas id="hex-transition-canvas"></canvas>
            <style>${css}</style>
            <div class="module-panel">
                <div class="module-panel-header">
                    <h2>${moduleConfig.name}</h2>
                    <button class="back-to-galaxy-btn" title="Back to Galaxy">&times;</button>
                </div>
                <div class="module-panel-body">${html}</div>
            </div>
        `;
        
        hexCanvas = document.getElementById('hex-transition-canvas');
        hexCtx = hexCanvas.getContext('2d');
        initHexGrid();
        
        const panel = overlay.querySelector('.module-panel');
        panel.style.opacity = 0; // Start hidden

        overlay.classList.add('visible');
        animateHexTransition(true); // Animate in

        setTimeout(async () => {
            if (typeof js.init === 'function') {
                await js.init(appStateRef);
            }
            panel.style.opacity = 1;
        }, 300); // Fade in panel during transition

        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);

    } catch (error) {
        console.error("Failed to show module overlay:", error);
        overlay.innerHTML = `<div class="module-panel"><p>Error loading module.</p><button class="back-to-galaxy-btn">&times;</button></div>`;
        overlay.querySelector('.back-to-galaxy-btn').addEventListener('click', hide);
        overlay.classList.add('visible');
    }
}

function hide() {
    if (!overlay.classList.contains('visible')) return;

    window.dispatchEvent(new CustomEvent('close-module-view'));

    const panel = overlay.querySelector('.module-panel');
    if(panel) panel.style.opacity = 0;

    animateHexTransition(false); // Animate out

    setTimeout(() => {
        overlay.classList.remove('visible');
        if (currentModule && currentModule.instance && typeof currentModule.instance.destroy === 'function') {
            currentModule.instance.destroy();
        }
        // overlay.innerHTML is cleared by the animation callback
        currentModule = null;
        appStateRef = null;
    }, 600); // Match animation duration
}

export const overlayService = {
    show,
    hide,
};