

import { threeManager } from '../../services/threeManager.js';
import { overlayService } from '../../services/overlayService.js';
import { ROUTES } from '../../constants.js';
import { soundService } from '../../services/soundService.js';

let appStateRef;
let galaxyCanvas;
let retryCount = 0;
const MAX_RETRIES = 20; // Increased retries for more resilience

// --- Module Lifecycle ---

const handlePlanetClick = (planet) => {
    if (planet && planet.userData.route) {
        // Find the full module configuration from the route hash
        const routeHash = planet.userData.route.substring(1); // remove '#'
        const moduleConfig = ROUTES.find(r => r.hash === routeHash);

        if (moduleConfig) {
            // 1. Animate camera to the planet
            threeManager.focusOnPlanet(planet, () => {
                // 2. When animation is done, show the module overlay, passing the appState
                overlayService.show(moduleConfig, appStateRef);
            });
        }
    }
};

const handleCloseModule = () => {
    overlayService.hide();
    threeManager.resetCamera();
};

/**
 * DEFINITIVE FIX: Robustly attempts to initialize the Three.js scene. 
 * It now checks three conditions:
 * 1. The canvas element still exists.
 * 2. The canvas element is still connected to the live DOM.
 * 3. The canvas element has valid, non-zero dimensions (BOTH width and height).
 * This prevents all race conditions with the router and CSS layout engine.
 */
function attemptThreeInit() {
    // 1. Check if canvas exists (it might have been destroyed by the router)
    if (!galaxyCanvas) return;

    // 2. CRITICAL: Check if the element is still part of the document.
    const isConnected = galaxyCanvas.isConnected;
    
    // 3. BULLETPROOF FIX: Check for valid 2D dimensions.
    const hasValidSize = galaxyCanvas.clientWidth > 0 && galaxyCanvas.clientHeight > 0;

    if (isConnected && hasValidSize) {
        console.log(`Galaxy canvas is connected and sized: ${galaxyCanvas.clientWidth}x${galaxyCanvas.clientHeight}. Initializing Three.js.`);
        threeManager.init(galaxyCanvas, handlePlanetClick);
    } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        // Log detailed status for debugging
        console.warn(`Galaxy canvas not ready. Retrying... (Attempt ${retryCount}/${MAX_RETRIES}). Connected: ${isConnected}, Size: ${galaxyCanvas.clientWidth}x${galaxyCanvas.clientHeight}`);
        requestAnimationFrame(attemptThreeInit);
    } else {
        console.error(`Galaxy canvas failed to initialize after ${MAX_RETRIES} retries. Aborting.`);
        const container = document.querySelector('.galaxy-container');
        if (container) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; text-align: center; font-family: var(--font-sans); padding: 2rem;">
                    <div>
                        <h2>Error Initializing Galaxy</h2>
                        <p>The 3D view could not be loaded. This might be due to a slow network or device. Please try refreshing the page.</p>
                    </div>
                </div>
            `;
        }
    }
}

export async function init(appState) {
    console.log("Home module (Knowledge Galaxy) initialized.");
    appStateRef = appState;
    
    galaxyCanvas = document.getElementById('galaxy-canvas');
    if (galaxyCanvas) {
        document.body.classList.add('galaxy-view');
        
        retryCount = 0; // Reset retry count for this initialization
        attemptThreeInit(); // Start the robust initialization attempt

        window.addEventListener('close-module-view', handleCloseModule);
    } else {
        console.error("Galaxy canvas element not found!");
    }
}

export function destroy() {
    threeManager.destroy();
    document.body.classList.remove('galaxy-view');
    window.removeEventListener('close-module-view', handleCloseModule);
    appStateRef = null;
    galaxyCanvas = null; // Important: nullify the canvas reference to stop any pending retries.
    console.log("Home module (Knowledge Galaxy) destroyed.");
}