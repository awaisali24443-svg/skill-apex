import { startGuestSession } from '../../services/authService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

const handleGuestLogin = () => {
    startGuestSession();
    // The onSessionStateChange listener in global.js will handle the redirect
};

export async function init() {
    document.getElementById('guest-btn')?.addEventListener('click', handleGuestLogin);
    sceneManager = await initModuleScene('.background-canvas', 'subtleParticles');
    
    // Signal that the module is fully loaded and ready to be displayed.
    document.dispatchEvent(new CustomEvent('moduleReady'));
}

export function cleanup() {
   sceneManager = cleanupModuleScene(sceneManager);
}