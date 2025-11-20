import { FEATURES } from '../../constants.js';
import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as stateService from '../../services/stateService.js';

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

function renderDailyQuests() {
    const quests = gamificationService.getDailyQuests();
    const container = document.getElementById('daily-quests-container');
    const list = document.getElementById('daily-quests-list');
    
    if (!quests || quests.length === 0) {
        container.style.display = 'none';
        return;
    }

    list.innerHTML = quests.map(quest => `
        <div class="quest-item ${quest.completed ? 'completed' : ''}">
            <div class="quest-info">
                <div class="quest-icon">
                    <svg class="icon"><use href="/assets/icons/feather-sprite.svg#${quest.completed ? 'check-circle' : 'circle'}"/></svg>
                </div>
                <span class="quest-text">${quest.text}</span>
            </div>
            <span class="quest-xp">+${quest.xp} XP</span>
        </div>
    `).join('');
    container.style.display = 'block';
}

function renderPrimaryAction() {
    const journeys = learningPathService.getAllJourneys();
    const path = journeys.find(j => j.currentLevel <= j.totalLevels);

    const card = document.getElementById('primary-action-card');
    const icon = document.getElementById('primary-action-icon');
    const title = document.getElementById('primary-action-title');
    const description = document.getElementById('primary-action-description');

    if (path) {
        card.href = `/#/game/${encodeURIComponent(path.goal)}`;
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#git-branch"/></svg>`;
        title.textContent = 'Continue Your Journey';
        description.textContent = `Next up in "${path.goal}": Level ${path.currentLevel}`;
    } else {
        card.href = '/#/topics';
        icon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#grid"/></svg>`;
        title.textContent = 'Start a New Journey';
        description.textContent = 'Search for any topic to begin a step-by-step learning path.';
    }
}

function renderRecentHistory() {
    const history = historyService.getRecentHistory(2);
    const container = document.getElementById('recent-history-container');
    if (history.length === 0 || !container) {
        if(container) container.style.display = 'none';
        return;
    }
    
    const cleanTopic = (topic) => topic.replace(/ - Level \d+$/, '').trim();

    container.innerHTML = '<h3>Recent Activity</h3>' + history.map(item => `
        <div class="card dashboard-card-small">
            <p>${cleanTopic(item.topic)}</p>
            <span>${item.score}/${item.totalQuestions}</span>
            <button class="btn retry-btn" data-topic="${cleanTopic(item.topic)}">Retry</button>
        </div>
    `).join('');
    container.style.display = 'block';

    historyClickHandler = (e) => {
        if(e.target.classList.contains('retry-btn')) {
            const topic = e.target.dataset.topic;
            stateService.setNavigationContext({ topic });
            window.location.hash = `#/game/${encodeURIComponent(topic)}`;
        }
    };
    container.addEventListener('click', historyClickHandler);
}


export function init() {
    renderStreak();
    renderDailyQuests();
    renderPrimaryAction();
    renderRecentHistory();
}

export function destroy() {
    const container = document.getElementById('recent-history-container');
    if (container && historyClickHandler) {
        container.removeEventListener('click', historyClickHandler);
    }
}