import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

export function init() {
    sceneManager = initModuleScene('.background-canvas', 'particleGalaxy');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}
