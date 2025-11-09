import * as quizState from '../../services/quizStateService.js';
import * as progressService from '../../services/progressService.js';
import * as missionService from '../../services/missionService.js';
import * as achievementService from '../../services/achievementService.js';
import { playSound } from '../../services/soundService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';
import { UNLOCK_SCORE, NUM_QUESTIONS } from '../../constants.js';

let sceneManager;

const resultsContainer = document.getElementById('results-container');

function renderResults() {
    const state = quizState.loadQuizState();
    if (!state) {
        // Fallback for when state is unexpectedly missing
        resultsContainer.innerHTML = `
            <div class="results-summary">
                <h2 class="results-title">Error</h2>
                <p>Could not load quiz results. The session may have expired.</p>
                <div class="results-actions">
                    <a href="#home" class="btn btn-primary">Go to Dashboard</a>
                </div>
            </div>`;
        return;
    }

    const { quizData, quizContext, userAnswers } = state;
    let score = 0;
    const missedConcepts = [];
    
    quizData.forEach((q, index) => {
        if (userAnswers[index] === q.correctAnswerIndex) {
            score++;
        } else {
            // Use a snippet of the question and explanation as a concept proxy
            const concept = `${q.question.substring(0, 30)}... (${q.explanation.substring(0, 40)}...)`;
            missedConcepts.push(concept);
        }
    });
    
    const percentage = Math.round((score / quizData.length) * 100);
    const passed = quizContext.isLeveled ? score >= UNLOCK_SCORE : percentage >= 60;

    playSound(passed ? 'complete' : 'incorrect');

    let resultsHTML = `
        <div id="results-summary" class="results-summary">
            <h1 class="results-title">${passed ? 'Quiz Complete!' : 'Needs Improvement'}</h1>
            <div class="score-display">
                <div class="score-circle ${passed ? 'passed' : 'failed'}">
                    <span class="score-number">${score}/${quizData.length}</span>
                    <span class="score-percentage">${percentage}%</span>
                </div>
            </div>
            <p class="results-topic">Topic: <strong>${quizContext.topicName}</strong></p>
        </div>
        
        <div class="results-feedback">
            ${quizContext.isLeveled ? `<p>You needed ${UNLOCK_SCORE} correct answers to level up.</p>` : ''}
            <p>${getFeedbackMessage(percentage)}</p>
        </div>

        <div class="results-actions">
            <button id="review-answers-btn" class="btn btn-secondary">Review Answers</button>
            <a href="${quizContext.returnHash || '#home'}" id="continue-btn" class="btn btn-primary">Continue</a>
        </div>
        
        <div id="review-section" class="review-section hidden">
            <h2>Review Your Answers</h2>
            ${quizData.map((q, i) => getReviewCardHTML(q, userAnswers[i])).join('')}
        </div>
    `;

    if (resultsContainer) {
        resultsContainer.innerHTML = resultsHTML;

        document.getElementById('review-answers-btn')?.addEventListener('click', () => {
            document.getElementById('review-section')?.classList.toggle('hidden');
        });

        // Update progress in the background, don't block UI
        handleProgressUpdate(quizContext, score, missedConcepts, percentage);
    }
    
    // Always clear the state after processing results
    quizState.clearQuizState();
}

function getFeedbackMessage(percentage) {
    if (percentage === 100) return "Perfect score! You're a true master.";
    if (percentage >= 80) return "Excellent work! You have a strong grasp of the material.";
    if (percentage >= 60) return "Good job! A little more study and you'll be an expert.";
    return "Don't give up! Review your answers and try again. You've got this!";
}

function getReviewCardHTML(question, userAnswer) {
    const isCorrect = userAnswer === question.correctAnswerIndex;
    let optionsHTML = question.options.map((option, index) => {
        let className = '';
        if (index === question.correctAnswerIndex) {
            className = 'correct';
        } else if (index === userAnswer) {
            className = 'incorrect';
        }
        return `<li class="${className}">${option}</li>`;
    }).join('');

    return `
        <div class="review-card">
            <p class="review-question">${question.question}</p>
            <ul class="review-options">${optionsHTML}</ul>
            <p class="review-explanation"><strong>Explanation:</strong> ${question.explanation}</p>
        </div>
    `;
}

async function handleProgressUpdate(quizContext, score, missedConcepts, percentage) {
    if (quizContext.isChallenge) {
        // Handle challenge mode scoring separately if needed in the future
        return;
    }

    try {
        const { xpGained, didLevelUp, newLevel } = await progressService.updateProgressAfterQuiz(quizContext, score, missedConcepts);
        window.showToast(`+${xpGained} XP earned!`, 'success');

        if (didLevelUp) {
            window.showLevelUpModal(newLevel);
        }

        const newProgress = await progressService.getProgress(true); // Get latest progress
        const newAchievements = await achievementService.checkAchievements(newProgress, quizContext, score);
        newAchievements.forEach(ach => {
            window.showToast(`🏆 Achievement Unlocked: ${ach.name}`);
        });

        await missionService.checkAndCompleteMissions(quizContext, score, percentage);
        
        await window.updateHeaderStats(); // Update header UI with new level/streak

    } catch (error) {
        console.error("Failed to update progress:", error);
        window.showToast(error.message, 'error');
    }
}

function init() {
    renderResults();
    sceneManager = initModuleScene('.background-canvas', 'subtleParticles');
}

function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}

const observer = new MutationObserver((mutationsList, obs) => {
    // Use a specific element ID to check for module unload
    if (!document.getElementById('results-summary')) {
        cleanup();
        obs.disconnect();
    }
});
observer.observe(document.getElementById('root-container'), { childList: true, subtree: true });

init();
