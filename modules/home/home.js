import { FEATURES } from '../../constants.js';
import * as gamificationService from '../../services/gamificationService.js';

function renderStreak() {
    const stats = gamificationService.getStats();
    const streakCounter = document.getElementById('streak-counter');
    if (stats.currentStreak > 0) {
        streakCounter.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="/assets/icons/feather-sprite.svg#zap"/></svg>
            Current Streak: <strong>${stats.currentStreak} Day${stats.currentStreak > 1 ? 's' : ''}</strong>
        `;
        streakCounter.style.display = 'inline-flex';
    } else {
        streakCounter.style.display = 'none';
    }
}

export function init(appState) {
    if (FEATURES.LEARNING_PATHS) {
        const learningPathCard = document.getElementById('learning-path-card');
        if (learningPathCard) {
            learningPathCard.style.display = 'flex';
        }
    }
    renderStreak();
}

export function destroy() {
    // No event listeners to remove
}
