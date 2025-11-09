import * as progressService from '../../services/progressService.js';
import { checkAndCompleteMissions } from '../../services/missionService.js';
import { checkAchievements } from '../../services/achievementService.js';
import * as geminiService from '../../services/geminiService.js';
import { UNLOCK_SCORE, MAX_LEVEL } from '../../constants.js';
import { playSound } from '../../services/soundService.js';
import * as quizState from '../../services/quizStateService.js';
import { SceneManager } from '../../services/threeManager.js';

let sceneManager;
let quizData = null;
let userAnswers = [];
let quizContext = {};

const resultsContainer = document.getElementById('results-container');

function triggerConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.id = 'confetti-container';
    document.body.appendChild(confettiContainer);

    const colors = ['var(--color-primary)', 'var(--color-secondary)', '#22c55e', '#f59e0b'];
    for (let i = 0; i < 150; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.animationDelay = `${Math.random() * 2}s`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        if (i % 3 === 0) {
            confetti.style.height = '15px';
            confetti.style.width = '7px';
            confetti.style.borderRadius = '2px';
        }

        confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
        confettiContainer.remove();
    }, 4000);
}

function animateCountUp(element, finalValue, prefix = '', suffix = '') {
    let current = 0;
    const duration = 1000;
    const increment = finalValue / (duration / 50);

    const timer = setInterval(() => {
        current += increment;
        if (current >= finalValue) {
            current = finalValue;
            clearInterval(timer);
        }
        element.textContent = `${prefix}${Math.ceil(current).toLocaleString()}${suffix}`;
    }, 50);
}


async function renderStandardResults(score) {
    const oldProgress = await progressService.getProgress();
    if (!oldProgress) {
        // Handle case where progress couldn't be fetched
        window.showToast('Error loading progress. Cannot save results.', 'error');
        return;
    }
    const oldLevelInfo = progressService.calculateLevelInfo(oldProgress.xp);

    const scorePercentage = Math.round((score / quizData.length) * 100);
    const baseXP = score * 10;
    const perfectBonus = score === quizData.length ? 50 : 0;
    const missionBonuses = await checkAndCompleteMissions(quizContext, score, scorePercentage);
    const missionXP = missionBonuses.reduce((sum, mission) => sum + mission.reward, 0);
    const totalXPGained = baseXP + perfectBonus + missionXP;
    
    // Record result and get the new state
    const newProgress = await progressService.recordQuizResult(quizContext.topicName, score, quizData, userAnswers, totalXPGained);
    
    // Check for achievements with the new progress state
    const newAchievements = await checkAchievements(newProgress, quizContext, score);
    newAchievements.forEach((ach, index) => {
        setTimeout(() => {
             window.showToast(`🏆 ${ach.name}: ${ach.description}`);
        }, 1000 + index * 500);
    });

    const newLevelInfo = progressService.calculateLevelInfo(newProgress.xp);
    
    if (newLevelInfo.level > oldLevelInfo.level) {
        setTimeout(() => window.showLevelUpModal(newLevelInfo.level), 1500);
    }

    playSound('complete');
    window.updateHeaderStats();
    
    let feedbackHtml = '';
    let primaryActionHtml = '';
    let secondaryActionsHtml = '';
    
    if (quizContext.isLeveled) {
        const didPass = score >= UNLOCK_SCORE;
        const currentLevel = await progressService.getCurrentLevel(quizContext.topicName);

        if (didPass) {
             if (currentLevel < MAX_LEVEL) {
                triggerConfetti();
                feedbackHtml = `<div class="results-feedback success"><strong>Topic Level ${quizContext.level} Passed!</strong> You've unlocked Level ${currentLevel}.</div>`;
                primaryActionHtml = `<button id="next-level-btn" class="btn btn-primary">New Quiz (Level ${currentLevel})</button>`;
            } else {
                 feedbackHtml = `<div class="results-feedback success"><strong>Congratulations!</strong> You've mastered ${quizContext.topicName}!</div>`;
                 primaryActionHtml = ``; // No more levels
            }
        } else {
            feedbackHtml = `<div class="results-feedback failure"><strong>Nice try!</strong> You need a score of at least ${UNLOCK_SCORE} to advance.</div>`;
            primaryActionHtml = `<button id="retry-level-btn" class="btn btn-primary">New Quiz (Retry Level ${quizContext.level})</button>`;
        }
    } else {
        primaryActionHtml = `<button id="retry-level-btn" class="btn btn-primary">New Quiz (Same Topic)</button>`;
    }

    const incorrectAnswers = quizData.filter((q, index) => userAnswers[index] !== q.correctAnswerIndex);
    if (incorrectAnswers.length > 0) {
        secondaryActionsHtml += `<button id="retry-missed-btn" class="btn btn-secondary">Retry Missed (${incorrectAnswers.length})</button>`;
    }
    secondaryActionsHtml += `<button id="retry-quiz-btn" class="btn btn-secondary">Retry Same Questions</button>`;
    secondaryActionsHtml += `<button id="challenge-friend-btn" class="btn btn-challenge">Challenge a Friend</button>`;
    secondaryActionsHtml += `<button id="back-to-topics-btn" class="btn btn-secondary">Back</button>`;

    const reviewHtml = quizData.map((q, index) => {
        const userAnswerIndex = userAnswers[index];
        const isIncorrect = userAnswerIndex !== q.correctAnswerIndex;
        
        const aiInsightHtml = isIncorrect && q.aiInsight 
            ? `<div class="ai-insight"><strong>AI Insight:</strong> ${q.aiInsight}</div>` 
            : '';

        return `<div class="review-item" style="animation-delay: ${index * 0.15}s">
            <p class="review-question">${index + 1}. ${q.question}</p>
            <div class="review-options">
                ${q.options.map((opt, i) => `<div class="review-option ${i === q.correctAnswerIndex ? 'review-correct' : (i === userAnswerIndex ? 'review-incorrect' : '')}">${opt}</div>`).join('')}
            </div>
            ${isIncorrect ? `<div class="review-explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
            ${aiInsightHtml}
        </div>`;
    }).join('');

    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

    resultsContainer.innerHTML = `
        <h2 class="results-title">Mission Complete!</h2>
        <div class="score-container">
            <svg class="score-circle" width="120" height="120" viewBox="0 0 120 120">
                <circle class="score-circle-bg" cx="60" cy="60" r="54"></circle>
                <circle id="score-fg" class="score-circle-fg" cx="60" cy="60" r="54" stroke="url(#score-gradient)" stroke-dasharray="${circumference}"></circle>
                <defs><linearGradient id="score-gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${scorePercentage < 50 ? 'var(--color-warning)' : 'var(--color-secondary)'}" /><stop offset="100%" stop-color="${scorePercentage < 50 ? 'var(--color-danger)' : 'var(--color-primary)'}" /></linearGradient></defs>
            </svg>
            <div id="score-text" class="score-text">${score}/${quizData.length}</div>
        </div>
        
        <div id="ai-coach-container" class="ai-coach-container"></div>
        
        <div class="xp-breakdown">
            <div class="xp-item" style="animation-delay: 0.2s"><span>Base Score</span><span class="xp-value" data-value="${baseXP}">+0</span></div>
            ${perfectBonus > 0 ? `<div class="xp-item" style="animation-delay: 0.4s"><span>Perfect Bonus</span><span class="xp-value" data-value="${perfectBonus}">+0</span></div>` : ''}
            ${missionBonuses.map((m, i) => `<div class="xp-item" style="animation-delay: ${0.6 + i*0.2}s"><span>${m.description}</span><span class="xp-value" data-value="${m.reward}">+0</span></div>`).join('')}
            <div class="xp-item total" style="animation-delay: 1s"><span>Total XP Gained</span><span class="xp-value" data-value="${totalXPGained}">+0</span></div>
        </div>

        ${feedbackHtml}
        <div class="results-actions">${primaryActionHtml}${secondaryActionsHtml}</div>
        <div class="review-container">${reviewHtml}</div>
    `;

    // --- AI Coach Insight ---
    const aiCoachContainer = document.getElementById('ai-coach-container');
    if (aiCoachContainer) {
        (async () => {
            try {
                aiCoachContainer.innerHTML = `<div class="spinner"></div><p>Generating AI feedback...</p>`;
                const incorrectAnswersForPrompt = quizData
                    .map((q, i) => ({ ...q, userAnswer: q.options[userAnswers[i]] }))
                    .filter((q, i) => userAnswers[i] !== q.correctAnswerIndex);
                const correctAnswersForPrompt = quizData.filter((q, i) => userAnswers[i] === q.correctAnswerIndex);

                let prompt;
                if (score === quizData.length) {
                    prompt = `The user got a perfect score! Here are the questions they answered correctly: ${JSON.stringify(correctAnswersForPrompt.map(q => q.question))}. Write a brief, encouraging message congratulating them on their mastery of the topic.`;
                } else {
                    prompt = `A user took a quiz on "${quizContext.topicName}". They got ${score} out of ${quizData.length} correct.
                    - Questions they got RIGHT: ${JSON.stringify(correctAnswersForPrompt.map(q => q.question))}
                    - Questions they got WRONG (with their incorrect answer and the correct explanation): ${JSON.stringify(incorrectAnswersForPrompt.map(q => ({question: q.question, theirAnswer: q.userAnswer, explanation: q.explanation})))}
                    Please provide a short, encouraging summary of their performance. Highlight a specific strength and a concept to review, based on their answers.`;
                }
                const insight = await geminiService.generateAICoachInsight(prompt);
                aiCoachContainer.innerHTML = `<div class="ai-coach-content"><strong>🤖 AI Coach:</strong> <span>${insight}</span></div>`;
            } catch (error) {
                console.error('AI Coach error:', error);
                aiCoachContainer.innerHTML = `<div class="ai-coach-content">🤖 AI Coach is unavailable at this time.</div>`;
            }
        })();
    }
    
    document.getElementById('retry-missed-btn')?.addEventListener('click', () => handleRetryMissed(incorrectAnswers));
    document.getElementById('challenge-friend-btn')?.addEventListener('click', handleChallengeFriend);
    const scoreFgCircle = document.getElementById('score-fg');
    setTimeout(() => {
        scoreFgCircle.style.strokeDashoffset = strokeDashoffset;
        document.querySelectorAll('.xp-value').forEach(el => {
            animateCountUp(el, parseInt(el.dataset.value), '+');
        });
    }, 100);
}

async function renderChallengeResults(score) {
    playSound('complete');
    const progress = await progressService.getProgress();
    if (!progress) return; // Guard clause

    const oldHighScore = progress.challengeHighScore || 0;
    const isNewHighScore = score > oldHighScore;
    
    if (isNewHighScore) {
        await progressService.updateUserProfile({ challengeHighScore: score });
        triggerConfetti();
    }
    
    resultsContainer.innerHTML = `
        <h2 class="results-title">Challenge Complete!</h2>
        <div class="challenge-high-score">High Score: <span>${isNewHighScore ? score : oldHighScore}</span></div>
        <div class="score-container"><div id="score-text" class="score-text" style="font-size: 3.5rem;">0</div></div>
        <p class="results-summary">${isNewHighScore ? "🎉 New High Score! 🎉" : "Great effort!"}</p>
        <div class="results-actions">
            <button id="retry-level-btn" class="btn btn-primary">Try Again</button>
            <button id="challenge-friend-btn" class="btn btn-challenge">Challenge a Friend</button>
            <button id="back-to-topics-btn" class="btn btn-secondary">Back to Dashboard</button>
        </div>
    `;
    
    animateCountUp(document.getElementById('score-text'), score);
}


async function _startNewQuiz(topicName, level, returnHash, promptOverride = null, isChallenge = false) {
    const progress = await progressService.getProgress();
    const history = progress.history[topicName] || { correct: 0, incorrect: 0 };
    const total = history.correct + history.incorrect;
    const performanceHistory = {
        recentCorrectPercentage: total > 5 ? (history.correct / total) * 100 : -1
    };

    let newQuizContext = { 
        topicName, 
        returnHash,
        prompt: promptOverride || `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be for a user at Level ${level} of ${MAX_LEVEL}.`,
        isLeveled: !promptOverride,
        level: level,
        generationType: 'quiz',
        isChallenge: isChallenge,
        performanceHistory: performanceHistory
    };
    sessionStorage.setItem('quizContext', JSON.stringify(newQuizContext));
    window.location.hash = '#loading';
}

function handleRetrySameQuiz() {
    if (quizData && quizContext) {
        quizState.startNewQuizState(quizData, quizContext);
        window.location.hash = '#quiz';
    } else {
        window.showToast("Error: Could not reload quiz data.", "error");
        window.location.hash = quizContext.returnHash || '#home';
    }
}

async function handleChallengeFriend() {
    const dataToShare = {
        context: quizContext,
        quiz: quizData
    };
    const compressedData = btoa(JSON.stringify(dataToShare));
    const url = `${window.location.origin}${window.location.pathname}#challenge=${compressedData}`;

    await window.showConfirmationModal({
        title: "Challenge Link Created!",
        text: "Share this link with a friend. They'll take the same quiz and see how they stack up against your score!",
        isAlert: true,
        confirmText: "Copy Link"
    });

    try {
        await navigator.clipboard.writeText(url);
        window.showToast("✅ Link copied to clipboard!");
    } catch (err) {
        window.showToast("Could not copy link automatically.", "error");
    }
}


function handleRetryMissed(missedQuestions) {
    playSound('start');
    const reviewContext = { ...quizContext, topicName: `${quizContext.topicName} (Review)`, isLeveled: false };
    quizState.startNewQuizState(missedQuestions, reviewContext);
    window.location.hash = '#quiz';
}

async function handleRetryLevel() {
    if (quizContext.isChallenge) {
        window.location.hash = '#challenge-setup';
    } else {
        const currentLevel = await progressService.getCurrentLevel(quizContext.topicName);
        _startNewQuiz(quizContext.topicName, currentLevel, quizContext.returnHash, quizContext.isLeveled ? null : quizContext.prompt);
    }
}

async function handleNextLevel() {
    const nextLevel = await progressService.getCurrentLevel(quizContext.topicName);
    _startNewQuiz(quizContext.topicName, nextLevel, quizContext.returnHash);
}

async function init() {
    const resultsString = sessionStorage.getItem('quizResults');
    if (!resultsString) {
        console.error("No results data found. Redirecting home.");
        window.location.hash = '#home';
        return;
    }

    try {
        const results = JSON.parse(resultsString);
        quizData = results.quizData;
        userAnswers = results.userAnswers;
        quizContext = results.quizContext;
        
        const score = userAnswers.reduce((acc, answer, index) => 
            (answer !== null && answer === quizData[index].correctAnswerIndex ? acc + 1 : acc), 0);

        if (quizContext.isChallenge) {
            await renderChallengeResults(score);
        } else {
            await renderStandardResults(score);
        }

        document.getElementById('back-to-topics-btn')?.addEventListener('click', () => window.location.hash = quizContext.returnHash || '#home');
        document.getElementById('next-level-btn')?.addEventListener('click', handleNextLevel);
        document.getElementById('retry-level-btn')?.addEventListener('click', handleRetryLevel);
        document.getElementById('retry-quiz-btn')?.addEventListener('click', handleRetrySameQuiz);

    } catch (e) {
        console.error("Failed to parse results data:", e);
        window.location.hash = '#home';
    } finally {
        sessionStorage.removeItem('quizResults');
    }

    setTimeout(() => {
        const canvas = document.querySelector('.background-canvas');
        if (canvas && window.THREE) {
            sceneManager = new SceneManager(canvas);
            sceneManager.init('subtleParticles');
        }
    }, 100);
}

window.addEventListener('hashchange', () => {
    if (sceneManager) {
        sceneManager.destroy();
        sceneManager = null;
    }
}, { once: true });

init();