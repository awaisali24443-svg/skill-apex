import { startGuestSession } from '../../services/authService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

const handleGuestLogin = () => {
    startGuestSession();
    // The onSessionStateChange listener in global.js will handle the redirect
};

export function init() {
    document.getElementById('guest-btn')?.addEventListener('click', handleGuestLogin);
    sceneManager = initModuleScene('.background-canvas', 'subtleParticles');
}

export function cleanup() {
   sceneManager = cleanupModuleScene(sceneManager);
}