import * as progressService from '../../services/progressService.js';
import { MAX_LEVEL } from '../../constants.js';
import { categoryData } from '../../services/topicService.js';
import { SceneManager } from '../../services/threeManager.js';
import { ALL_ACHIEVEMENTS } from '../../services/achievementService.js';
import { generateNemesisQuiz } from '../../services/geminiService.js';
import { startQuizFlow } from '../../services/navigationService.js';

let sceneManager;

const topicCategories = Object.values(categoryData).reduce((acc, category) => {
    acc[category.categoryTitle] = category.topics.map(topic => topic.name);
    return acc;
}, {});

function renderAchievements(unlockedAchievements) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    grid.innerHTML = ALL_ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        return `
            <div class="achievement-badge ${isUnlocked ? 'unlocked' : ''}" data-tooltip="${ach.name}: ${ach.description}">
                <span class="badge-icon">${ach.icon}</span>
            </div>
        `;
    }).join('');
}

async function handleNemesisQuiz(e) {
    const topicName = e.currentTarget.dataset.topic;
    const progress = await progressService.getProgress();
    const missedConcepts = progress.history[topicName]?.missedConcepts || [];

    if (missedConcepts.length < 3) {
        await window.showConfirmationModal({
            title: "Not Enough Data",
            text: "Answer a few more questions incorrectly in this topic to generate a targeted Nemesis Quiz!",
            isAlert: true
        });
        return;
    }
    
    // Create a concise list of unique concepts
    const concepts = [...new Set(missedConcepts.map(c => c.split('.')[0]))].slice(0, 5).join(', ');
    const prompt = generateNemesisQuiz(topicName, concepts);
    
    const quizContext = {
        topicName: `Nemesis: ${topicName}`,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#screen',
        generationType: 'quiz'
    };

    await startQuizFlow(quizContext);
}


async function renderProgress() {
    const progress = await progressService.getProgress();
    if (!progress) {
        // Handle case where progress is not available
        document.getElementById('progress-loading').innerHTML = '<p>Could not load progress.</p>';
        return;
    }

    const { achievements, history, levels } = progress;

    renderAchievements(achievements || []);

    // Calculate and Render Overall Stats
    const totalQuizzes = Object.values(history || {}).reduce((sum, item) => sum + item.correct + item.incorrect, 0) / 5; // Assuming 5 questions per quiz
    const totalCorrect = Object.values(history || {}).reduce((sum, item) => sum + item.correct, 0);
    const totalPossibleScore = totalQuizzes * 5;
    const avg = totalPossibleScore > 0 ? Math.round((totalCorrect / totalPossibleScore) * 100) : 0;
    const totalLevelsUnlocked = Object.values(levels || {}).reduce((sum, level) => sum + (level - 1), 0);
    
    document.getElementById('total-quizzes').textContent = Math.floor(totalQuizzes);
    document.getElementById('average-score').textContent = `${avg}%`;
    document.getElementById('levels-unlocked').textContent = totalLevelsUnlocked;

    // Render Topic-specific Progress
    const progressListContainer = document.getElementById('progress-list-container');
    let allProgressHtml = '';

    for (const category in topicCategories) {
        const topicsInCategory = topicCategories[category];
        const categoryProgressHtml = topicsInCategory
            .filter(topic => levels && levels[topic] > 1)
            .map(topic => createProgressItemHtml(topic, levels[topic], history[topic]))
            .join('');

        if (categoryProgressHtml.trim() !== '') {
            allProgressHtml += `
                <div class="progress-category">
                    <h2>${category}</h2>
                    <div class="progress-list">${categoryProgressHtml}</div>
                </div>
            `;
        }
    }

    if (Object.keys(levels || {}).length === 0) {
        progressListContainer.innerHTML = '<p class="no-progress-message">You haven\'t started any leveled quizzes yet. Launch a mission from the Topic Universe to begin!</p>';
    } else {
        progressListContainer.innerHTML = allProgressHtml;
        document.querySelectorAll('.nemesis-quiz-btn').forEach(btn => btn.addEventListener('click', handleNemesisQuiz));
    }
}

function createProgressItemHtml(topic, level, history) {
    const percentage = ((level - 1) / (MAX_LEVEL - 1)) * 100;
    const incorrectCount = history?.incorrect || 0;

    const nemesisButtonHtml = incorrectCount >= 3 ? 
        `<button class="nemesis-quiz-btn" data-topic="${topic}">⚡ Nemesis Quiz</button>` : '';

    return `
        <div class="progress-item">
            <div class="progress-item-main">
                <div class="progress-item-info">
                    <strong>${topic}</strong>
                    <div class="progress-item-level">Level ${level}</div>
                </div>
                <div class="topic-progress-bar-container">
                    <div class="topic-progress-bar" style="width: ${percentage}%"></div>
                </div>
                ${nemesisButtonHtml}
            </div>
        </div>
    `;
}

async function init() {
    const loadingEl = document.getElementById('progress-loading');
    const contentEl = document.getElementById('progress-content');
    
    await renderProgress();
    
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    const canvas = document.querySelector('.background-canvas');
    if (canvas && window.THREE) {
        sceneManager = new SceneManager(canvas);
        sceneManager.init('calmGeometric');
    }
}

function cleanup() {
     if (sceneManager) {
        sceneManager.destroy();
        sceneManager = null;
    }
}

// Use MutationObserver for robust cleanup
const observer = new MutationObserver((mutationsList, obs) => {
    if (!document.querySelector('.progress-container')) {
        cleanup();
        obs.disconnect();
    }
});
observer.observe(document.getElementById('root-container'), { childList: true, subtree: true });


init();