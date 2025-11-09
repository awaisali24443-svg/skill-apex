import { NUM_QUESTIONS } from '../../constants.js';
import { playSound } from '../../services/soundService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { getProgress, calculateLevelInfo } from '../../services/progressService.js';
import { getActiveMissions } from '../../services/missionService.js';
import { StellarMap } from '../../services/stellarMap.js';

let stellarMap;

function displayDailyMissions() {
    const container = document.getElementById('daily-missions-container');
    if (!container) return;
    const missions = getActiveMissions();
    
    let html = missions.map(mission => `
        <div class="mission-card ${mission.isComplete ? 'completed' : ''}">
            <p class="mission-title">${mission.description}</p>
            <p class="mission-reward">+${mission.reward} XP</p>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function updatePlayerStats() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const progress = getProgress();
    const { level, currentXP, nextLevelXP, percentage } = calculateLevelInfo(progress.stats.xp);
    
    document.getElementById('player-name').textContent = `Agent, ${profile.name || 'Welcome Back'}`;
    document.getElementById('player-level').textContent = `LVL ${level}`;
    document.getElementById('xp-progress-text').textContent = `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()} XP`;
    document.getElementById('xp-progress-bar').style.width = `${percentage}%`;
}


function cleanup() {
    if (stellarMap) {
        stellarMap.destroy();
        stellarMap = null;
    }
}

function init() {
    updatePlayerStats();
    displayDailyMissions();
    
    // Defer scene initialization to improve perceived performance
    setTimeout(() => {
        const canvas = document.getElementById('stellar-map-canvas');
        if (canvas && window.THREE) {
            stellarMap = new StellarMap(canvas);
            stellarMap.init();
        }
    }, 100);
}

const observer = new MutationObserver((mutationsList, obs) => {
    for(const mutation of mutationsList) {
        if (mutation.type === 'childList' && !document.querySelector('.mission-control-container')) {
            cleanup();
            obs.disconnect();
            return;
        }
    }
});
observer.observe(document.getElementById('root-container'), { childList: true });

init();