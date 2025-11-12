import { initializeCardGlow } from '../../global/global.js';
import { FEATURES } from '../../constants.js';

export function init(appState) {
    if (FEATURES.LEARNING_PATHS) {
        const learningPathCard = document.getElementById('learning-path-card');
        if (learningPathCard) {
            learningPathCard.style.display = 'flex';
        }
    }
    initializeCardGlow(document.querySelector('.home-container'));
}

export function destroy() {
    // No event listeners to remove
}
