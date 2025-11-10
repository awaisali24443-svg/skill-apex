import * as quizState from '../../services/quizStateService.js';
import * as progress from '../../services/progressService.js';
import * as missions from '../../services/missionService.js';
import * as achievements from '../../services/achievementService.js';
import * as learning from '../../services/learningPathService.js';
import * as library from '../../services/libraryService.js';
import { playSound } from '../../services/soundService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let state;

const feedbackMessages = {
    perfect: "Outstanding! A flawless performance.",
    great: "Excellent work! You've clearly mastered this topic.",
    good: "Good job! You have a solid understanding.",
    average: "Not bad! A little more practice and you'll be an expert.",
    poor: "You're on the right track! Review the answers to improve."
};

function getFeedback(percentage) {
    if (percentage === 100) return feedbackMessages.perfect;
    if (percentage >= 80) return feedbackMessages.great;
    if (percentage >= 60) return feedbackMessages.good;
    if (percentage >= 40) return feedbackMessages.average;
    return feedbackMessages.poor;
}

async function renderResults() {
    state = quizState.loadQuizState();
    if (!state) {
        document.getElementById('results-container').innerHTML = `<h2>Error</h2><p>Could not load quiz results.</p>`;
        return;
    }

    const { quizData, userAnswers, quizContext } = state;
    const score = userAnswers.filter((answer, i) => answer === quizData[i].correctAnswerIndex).length;
    const percentage = Math.round((score / quizData.length) * 100);

    document.getElementById('score-number').textContent = `${score}/${quizData.length}`;
    document.getElementById('score-percentage').textContent = `${percentage}%`;
    document.getElementById('results-topic').textContent = quizContext.topicName;
    document.getElementById('score-circle').classList.add(percentage >= 60 ? 'passed' : 'failed');
    document.getElementById('results-feedback').textContent = getFeedback(percentage);
    
    // Save progress and check for level-ups/achievements
    const missedConcepts = quizData.filter((q,i) => userAnswers[i] !== q.correctAnswerIndex).map(q => q.explanation.split('.')[0]);
    const { xpGained, newLevel } = await progress.recordQuizResult(quizContext.topicName, score, quizData.length, quizContext.isLeveled, missedConcepts);
    
    // Handle learning path progression
    if (quizContext.learningPathInfo && score >= 3) {
        await learning.updateLearningPathProgress(quizContext.learningPathInfo.pathId, quizContext.learningPathInfo.stepIndex);
    }
    
    // Update missions and check for achievements
    await missions.updateMissionProgress('quiz_completed', { score });
    let newAchievements = await achievements.checkAndUnlockAchievements('quiz_completed', { score, totalQuestions: quizData.length });
    if (newLevel !== -1) {
        const levelAchievements = await achievements.checkAndUnlockAchievements('level_up', { newLevel });
        newAchievements = newAchievements.concat(levelAchievements);
    }

    newAchievements.forEach(ach => window.showToast(`🏆 Achievement Unlocked: ${ach.name}`, 'success'));


    renderReviewSection();
    setupActionButtons(score, quizData.length, quizContext.topicName);
    playSound('complete');
}

function renderReviewSection() {
    const container = document.getElementById('review-answers-container');
    container.innerHTML = state.quizData.map((q, i) => {
        const userAnswer = state.userAnswers[i];
        return `
            <div class="review-card">
                <p class="review-question">${i + 1}. ${q.question}</p>
                <ul class="review-options">
                    ${q.options.map((opt, j) => `
                        <li class="${j === q.correctAnswerIndex ? 'correct' : (j === userAnswer ? 'incorrect' : '')}">
                            ${opt}
                        </li>
                    `).join('')}
                </ul>
                <div class="review-explanation"><strong>Explanation:</strong> ${q.explanation}</div>
            </div>
        `;
    }).join('');
}

function setupActionButtons(score, total, topic) {
    document.getElementById('retry-quiz-btn').addEventListener('click', () => {
        sessionStorage.setItem('quizContext', JSON.stringify(state.quizContext));
        window.location.hash = '#loading';
    });

    document.getElementById('share-results-btn').addEventListener('click', () => {
        const shareData = {
            title: 'Knowledge Tester Results',
            text: `I scored ${score}/${total} on the ${topic} quiz! Can you beat my score?`,
            url: window.location.href,
        };
        if (navigator.share) {
            navigator.share(shareData).catch(err => console.error("Share failed:", err));
        } else {
            window.showToast("Share feature not available on this browser.", "warning");
        }
    });
    
    const saveBtnContainer = document.getElementById('save-library-btn-container');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-secondary';
    saveBtn.textContent = 'Save to Library';
    saveBtn.onclick = async () => {
        await library.saveQuizToLibrary(state.quizData, state.quizContext);
        window.showToast('Quiz saved to your library!', 'success');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saved!';
    };
    saveBtnContainer.appendChild(saveBtn);
}


export async function init() {
    await renderResults();
    quizState.clearQuizState();
    sceneManager = await initModuleScene('.background-canvas', 'atomicStructure');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    state = null;
}