import { initializeCardGlow } from '../../global/global.js';
import { isFeatureEnabled } from '../../services/featureService.js';

export async function init(appState) {
    console.log("Home module (Dashboard) initialized.");

    const learningPathCard = document.getElementById('learning-path-card');
    if (learningPathCard && isFeatureEnabled('learningPaths')) {
        learningPathCard.style.display = 'flex';
    }

    initializeCardGlow();
}

export function destroy() {
    console.log("Home module (Dashboard) destroyed.");
    // No specific cleanup needed for this simple version.
}