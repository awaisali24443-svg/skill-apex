
import { threeManager } from '../../services/threeManager.js';
import { toastService } from '../../services/toastService.js';

let appStateRef;
let galaxyContainer;

// --- Module Lifecycle ---

const handlePlanetNavigation = (route) => {
    if (route) {
        window.location.hash = route;
    }
};

export async function init(appState) {
    console.log("Home module (Knowledge Galaxy) initialized.");
    appStateRef = appState;
    
    galaxyContainer = document.getElementById('galaxy-canvas');
    if (galaxyContainer) {
        document.body.classList.add('galaxy-view');
        threeManager.init(galaxyContainer, handlePlanetNavigation);
    } else {
        console.error("Galaxy canvas container not found!");
    }
}

export function destroy() {
    threeManager.destroy();
    document.body.classList.remove('galaxy-view');
    appStateRef = null;
    console.log("Home module (Knowledge Galaxy) destroyed.");
}
