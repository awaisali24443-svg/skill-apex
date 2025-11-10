import * as quizState from '../../services/quizStateService.js';
import * as progressService from '../../services/progressService.js';
import { playSound } from '../../services/soundService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { createActivity } from '../../services/activityFeedService.js';
import { checkAndUnlockAchievements } from '../../services/achievementService.js';

let sceneManager;

async function renderChallengeResults() {
    const contentEl = document.getElementById('results-content');
    const state = quizState.loadQuizState();

    if (!state) {
        contentEl.innerHTML = `<h2>Error</h2><p>Could not load challenge results.</p><a href="#home" class="btn btn-primary">Go Home</a>`;
        return;
    }

    let score = 0;
    state.quizData.forEach((q, index) => {
        if (state.userAnswers[index] === q.correctAnswerIndex) {
            score++;
        }
    });
    
    playSound('complete');
    
    const progress = await progressService.getProgress();
    const personalBest = progress.challengeHighScore || 0;
    let newBest = false;
    
    if (score > personalBest) {
        newBest = true;
        await progressService.updateUserProfile({ challengeHighScore: score });
        createActivity({ type: 'high_score', text: `set a new high score of ${score} in Challenge Mode!`, icon: '🔥' });
    }

    // Check for achievements related to challenge mode
    const newAchievements = await checkAndUnlockAchievements('challenge_score_recorded', { score });
    newAchievements.forEach(ach => window.showToast(`🏆 Achievement Unlocked: ${ach.name}`, 'success'));


    let highScoreHTML = newBest
        ? `<h3 class="new-high-score-banner">🔥 New High Score! 🔥</h3>`
        : `<p class="high-score-comparison">Your Personal Best: <strong>${personalBest}</strong></p>`;

    contentEl.innerHTML = `
        <h2 class="results-title">Challenge Complete!</h2>
        <p class="final-score">${score}</p>
        <p class="score-label">Points</p>
        <div class="high-score-section">
            ${highScoreHTML}
        </div>
        <div class="results-actions">
            <a href="#challenge-setup" class="btn btn-secondary">Try Again</a>
            <a href="#home" class="btn btn-primary">Go to Dashboard</a>
        </div>
    `;

    quizState.clearQuizState();
}


export async function init() {
    await renderChallengeResults();
    sceneManager = await initModuleScene('.background-canvas', 'abstractHub');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}