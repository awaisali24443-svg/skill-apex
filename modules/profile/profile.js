import * as gamificationService from '../../services/gamificationService.js';
import * as historyService from '../../services/historyService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as apiService from '../../services/apiService.js';
import { getXpForNextLevel } from '../../services/gamificationService.js';

let appState;

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
            card.querySelector('.journey-details').textContent = `${path.path.length} levels • Created on ${new Date(path.createdAt).toLocaleDateString()}`;
            card.querySelector('.progress-bar-fill').style.width = `${progress * 100}%`;
            card.querySelector('.progress-text').textContent = `Progress: ${path.currentStep} / ${path.path.length}`;

            listContainer.appendChild(card);
        });
    }
}

async function loadSmartReview() {
    const history = historyService.getHistory();
    const section = document.getElementById('smart-review-section');
    if (!section || history.length < 3) {
        return; // Don't show the feature if there isn't enough data
    }
    
    try {
        const analysis = await apiService.analyzePerformance(history);
        if (analysis && analysis.weakTopics && analysis.weakTopics.length > 0) {
            renderSmartReviewCard(analysis.weakTopics);
        }
    } catch (error) {
        console.warn('Could not load smart review feature.', error);
        section.style.display = 'none';
    }
}

function renderSmartReviewCard(topics) {
    const section = document.getElementById('smart-review-section');
    const template = document.getElementById('smart-review-template');
    
    const card = template.content.cloneNode(true);
    card.querySelector('.smart-review-description').textContent = "The AI has analyzed your quiz history and suggests creating a custom quiz to review these topics:";
    
    const topicsList = card.querySelector('.weak-topics-list');
    topics.forEach(topic => {
        const tag = document.createElement('span');
        tag.className = 'weak-topic-tag';
        tag.textContent = topic;
        topicsList.appendChild(tag);
    });

    card.querySelector('.start-review-btn').addEventListener('click', () => {
        appState.context = {
            topic: `Personalized Review: ${topics.join(', ')}`,
            numQuestions: 10,
            difficulty: 'medium',
            learningContext: `This is a personalized review quiz focusing on topics the user has struggled with. The questions should test foundational concepts from these topics: ${topics.join(', ')}.`
        };
        window.location.hash = '/loading';
    });

    section.innerHTML = '';
    section.appendChild(card);
    section.style.display = 'block';
}


export function init(globalState) {
    appState = globalState;
    renderStats();
    renderLearningJourneys();
    renderAchievements();
    loadSmartReview();
}

export function destroy() {
    // No dynamic event listeners to remove that are directly on module container
}