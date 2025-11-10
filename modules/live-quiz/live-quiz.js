import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

export async function init() {
    sceneManager = await initModuleScene('.background-canvas', 'dataStream');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}