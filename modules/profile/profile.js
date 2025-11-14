import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import { getXpForNextLevel } from '../../services/gamificationService.js';

function renderStats() {
    const stats = gamificationService.getStats();
    const history = historyService.getHistory();
    const profileStats = gamificationService.getProfileStats(history);
    
    document.getElementById('profile-level').textContent = stats.level;
    const xpNeeded = getXpForNextLevel(stats.level);
    const xpProgress = xpNeeded > 0 ? (stats.xp / xpNeeded) * 100 : 100;
    
    const xpBarFill = document.getElementById('xp-bar-fill');
    if (xpBarFill) {
        xpBarFill.style.width = `${xpProgress}%`;
    }
    
    document.getElementById('xp-text').textContent = `${stats.xp} / ${xpNeeded} XP`;

    document.getElementById('current-streak-stat').textContent = stats.currentStreak;
    document.getElementById('total-quizzes-stat').textContent = profileStats.totalQuizzes;
    document.getElementById('total-questions-stat').textContent = profileStats.totalQuestions;
    document.getElementById('average-score-stat').textContent = `${profileStats.averageScore}%`;
}

function renderAchievements() {
    const achievements = gamificationService.getAchievements();
    const grid = document.getElementById('achievements-grid');
    const template = document.getElementById('achievement-template');
    grid.innerHTML = '';

    achievements.forEach(ach => {
        const card = template.content.cloneNode(true);
        const cardEl = card.querySelector('.achievement-card');
        
        cardEl.classList.add(ach.unlocked ? 'unlocked' : 'locked');
        cardEl.setAttribute('aria-label', `${ach.name}: ${ach.description}. ${ach.unlocked ? 'Status: Unlocked.' : 'Status: Locked.'}`);

        const use = card.querySelector('use');
        use.setAttribute('href', `/assets/icons/feather-sprite.svg#${ach.icon}`);
        
        card.querySelector('.achievement-name').textContent = ach.name;
        card.querySelector('.achievement-description').textContent = ach.description;
        
        grid.appendChild(card);
    });
}

function renderLearningJourneys() {
    const paths = learningPathService.getAllPaths();
    const listContainer = document.getElementById('journeys-list');
    const noPathsMessage = document.getElementById('no-journeys-message');
    const template = document.getElementById('journey-item-template');
    
    listContainer.innerHTML = '';
    
    if (paths.length === 0) {
        noPathsMessage.style.display = 'block';
    } else {
        noPathsMessage.style.display = 'none';
        paths.forEach(path => {
            const card = template.content.cloneNode(true);
            const cardLink = card.querySelector('.journey-item-card');
            cardLink.href = `/#/learning-path/${path.id}`;
            
            card.querySelector('.journey-goal').textContent = path.goal;
            const progress = path.currentStep / path.path.length;
            card.querySelector('.journey-details').textContent = `${path.path.length} chapters • Created on ${new Date(path.createdAt).toLocaleDateString()}`;
            card.querySelector('.progress-bar-fill').style.width = `${progress * 100}%`;
            card.querySelector('.progress-text').textContent = `Progress: ${path.currentStep} / ${path.path.length}`;

            listContainer.appendChild(card);
        });
    }
}

export function init(appState) {
    renderStats();
    renderLearningJourneys();
    renderAchievements();
}

export function destroy() {
    // No dynamic event listeners to remove
}