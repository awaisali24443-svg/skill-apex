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

function renderPrimaryAction() {
    const path = learningPathService.getLatestInProgressPath();
    const card = document.getElementById('primary-action-card');
    const icon = document.getElementById('primary-action-icon');
    const title = document.getElementById('primary-action-title');
    const description = document.getElementById('primary-action-description');

    if (path) {
        card.href = `/#/learning-path/${path.id}`;
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#git-branch"/></svg>`;
        title.textContent = 'Continue Your Journey';
        description.textContent = `Next up in "${path.goal}": ${path.path[path.currentStep].name}`;
    } else {
        card.href = '/#/topics';
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#grid"/></svg>`;
        title.textContent = 'Start a New Journey';
        description.textContent = 'Search for any topic to begin a step-by-step learning path.';
    }
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
            <button class="btn retry-btn" data-topic="${item.topic}" data-difficulty="${item.difficulty || 'medium'}">Retry</button>
        </div>
    `).join('');
    container.style.display = 'block';

    historyClickHandler = (e) => {
        if(e.target.classList.contains('retry-btn')) {
            const topic = e.target.dataset.topic;
            const difficulty = e.target.dataset.difficulty;
            appState.context = {
                topic,
                numQuestions: 10,
                difficulty,
            };
            window.location.hash = '/loading';
        }
    };
    container.addEventListener('click', historyClickHandler);
}


export function init(appState) {
    renderStreak();
    if (FEATURES.LEARNING_PATHS) {
        renderPrimaryAction();
    }
    renderRecentHistory(appState);
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}