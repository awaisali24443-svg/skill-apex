import { threeManager } from '../../services/threeManager.js';
import { ROUTES } from '../../constants.js';

let appStateRef;

function handlePlanetClick(target) {
    const routeHash = target.userData.route;
    if (!routeHash) return;
    
    // Find the full route configuration
    const routeConfig = ROUTES.find(r => `#${r.hash}` === routeHash);
    if (!routeConfig) {
        console.warn(`No route config found for: ${routeHash}`);
        return;
    }
    
    // Directly navigate by changing the hash. The main router in index.js will handle the rest.
    window.location.hash = routeHash;
}


export async function init(appContainer, appState) {
    console.log("Home module (Galaxy) initialized.");
    appStateRef = appState;
    const canvas = document.getElementById('galaxy-canvas');
    if (!canvas) {
        console.error("Galaxy canvas not found!");
        return;
    }
    // Pass the main container's dimensions for the renderer
    await threeManager.init(canvas, handlePlanetClick);
}

export function destroy() {
    console.log("Home module (Galaxy) destroyed.");
    // threeManager.destroy() is now called from the main router in index.js
    // to ensure it happens *before* the new module's content is added.
    appStateRef = null;
}