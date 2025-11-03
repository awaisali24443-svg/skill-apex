import * as progressService from '../../services/progressService.js';
import { MAX_LEVEL } from '../../constants.js';

console.log("Screen module loaded.");

const topics = {
    programming: ['Python', 'JavaScript', 'Java', 'SQL', 'TypeScript', 'C++'],
    history: ['Ancient Rome', 'Ancient Egypt', 'The Mughal Empire', 'The Ottoman Empire']
};

function renderProgress() {
    const progress = progressService.getProgress();
    const { stats, levels } = progress;

    // Render Overall Stats
    const totalQuizzesEl = document.getElementById('total-quizzes');
    const averageScoreEl = document.getElementById('average-score');
    const levelsUnlockedEl = document.getElementById('levels-unlocked');

    if (totalQuizzesEl) totalQuizzesEl.textContent = stats.totalQuizzes;
    
    if (averageScoreEl) {
        const totalPossibleScore = stats.totalQuizzes * 5; // Assuming 5 questions per quiz
        const avg = totalPossibleScore > 0 ? Math.round((stats.totalCorrect / totalPossibleScore) * 100) : 0;
        averageScoreEl.textContent = `${avg}%`;
    }

    if (levelsUnlockedEl) {
        // Sum of all levels unlocked (level 1 counts as 0 unlocked levels)
        const totalLevelsUnlocked = Object.values(levels).reduce((sum, level) => sum + (level - 1), 0);
        levelsUnlockedEl.textContent = totalLevelsUnlocked;
    }

    // Render Topic-specific Progress
    const programmingList = document.getElementById('programming-progress-list');
    const historicalList = document.getElementById('historical-progress-list');

    if (programmingList) {
        programmingList.innerHTML = topics.programming.map(topic => 
            createProgressItemHtml(topic, levels[topic] || 1)
        ).join('');
    }

    if (historicalList) {
        historicalList.innerHTML = topics.history.map(topic => 
            createProgressItemHtml(topic, levels[topic] || 1)
        ).join('');
    }
}

function createProgressItemHtml(topic, level) {
    const percentage = ((level - 1) / (MAX_LEVEL - 1)) * 100;
    return `
        <div class="progress-item">
            <div class="progress-item-info">
                <strong>${topic}</strong>
                <div class="topic-progress-bar-container">
                    <div class="topic-progress-bar" style="width: ${percentage}%"></div>
                </div>
            </div>
            <div class="progress-item-level">
                Level ${level}
            </div>
        </div>
    `;
}

// Initial render
renderProgress();
