import { FEATURES } from '../../constants.js';
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';

let historyClickHandler;

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

function renderContinueLearning() {
    const path = learningPathService.getLatestInProgressPath();
    const container = document.getElementById('continue-learning-container');
    if (!path || !container) {
        if(container) container.style.display = 'none';
        return;
    }

    const progress = (path.currentStep / path.path.length) * 100;
    container.innerHTML = `
        <h3>Continue Learning</h3>
        <a href="/#/learning-path/${path.id}" class="card dashboard-card">
            <h4>${path.goal}</h4>
            <p>Next up: ${path.path[path.currentStep].name}</p>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${progress}%;"></div>
            </div>
            <span>${path.currentStep} / ${path.path.length} steps completed</span>
        </a>
    `;
    container.style.display = 'block';
}

function renderRecentHistory(appState) {
    const history = historyService.getRecentHistory(2);
    const container = document.getElementById('recent-history-container');
    if (history.length === 0 || !container) {
        if(container) container.style.display = 'none';
        return;
    }
    
    container.innerHTML = '<h3>Recent Activity</h3>' + history.map(item => `
        <div class="card dashboard-card-small">
            <p>${item.topic}</p>
            <span>${item.score}/${item.totalQuestions}</span>
            <button class="btn retry-btn" data-topic="${item.topic}">Retry</button>
        </div>
    `).join('');
    container.style.display = 'block';

    historyClickHandler = (e) => {
        if(e.target.classList.contains('retry-btn')) {
            const topic = e.target.dataset.topic;
            appState.context = {
                topic,
                numQuestions: 10,
                difficulty: 'medium',
            };
            window.location.hash = '/loading';
        }
    };
    container.addEventListener('click', historyClickHandler);
}


export function init(appState) {
    renderStreak();
    if (FEATURES.LEARNING_PATHS) {
        renderContinueLearning();
    }
    renderRecentHistory(appState);
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}