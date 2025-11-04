import * as progressService from '../../services/progressService.js';
import { UNLOCK_SCORE, MAX_LEVEL } from '../../constants.js';
import { playSound } from '../../services/soundService.js';

let quizData = null;
let userAnswers = [];
let quizContext = {};

const resultsContainer = document.getElementById('results-container');

function animateCountUp(element, finalValue, total) {
    let current = 0;
    const duration = 1000; // 1 second
    const stepTime = Math.abs(Math.floor(duration / finalValue)) || 50;
    
    const timer = setInterval(() => {
        current += 1;
        element.textContent = `${current}/${total}`;
        if (current === finalValue) {
            clearInterval(timer);
        }
    }, stepTime);
}

function renderResults() {
    playSound('complete');
    const score = userAnswers.reduce((acc, answer, index) => 
        (answer === quizData[index].correctAnswerIndex ? acc + 1 : acc), 0);
    
    progressService.recordQuizResult(score, quizData.length);

    const scorePercentage = Math.round((score / quizData.length) * 100);
    
    let feedbackHtml = '';
    let actionsHtml = '';

    if (quizContext.isLeveled === false) {
        // Logic for non-leveled (optional) quizzes
        if (scorePercentage >= 80) {
            feedbackHtml = `<div class="results-feedback success"><strong>Great job!</strong> A fantastic score.</div>`;
        } else if (scorePercentage >= 50) {
            feedbackHtml = `<div class="results-feedback"><strong>Good effort!</strong> Keep practicing.</div>`;
        } else {
            feedbackHtml = `<div class="results-feedback failure"><strong>Keep trying!</strong> Every quiz is a learning opportunity.</div>`;
        }
        actionsHtml = `<button id="retry-level-btn" class="btn btn-primary">Try This Topic Again</button>`;
    } else {
        // Level Progression Logic
        const didPass = score >= UNLOCK_SCORE;
        const isMaxLevel = quizContext.level >= MAX_LEVEL;

        if (didPass) {
            if (!isMaxLevel) {
                const newLevel = quizContext.level + 1;
                feedbackHtml = `<div class="results-feedback success"><strong>Level ${quizContext.level} Passed!</strong> You've unlocked Level ${newLevel}.</div>`;
                actionsHtml = `<button id="next-level-btn" class="btn btn-primary">Play Next Level</button>`;
                progressService.unlockNextLevel(quizContext.topicName, MAX_LEVEL);
            } else {
                feedbackHtml = `<div class="results-feedback success"><strong>Congratulations!</strong> You've mastered ${quizContext.topicName} by completing the final level!</div>`;
            }
        } else {
            feedbackHtml = `<div class="results-feedback failure"><strong>Nice try!</strong> You need a score of at least ${UNLOCK_SCORE} to unlock the next level.</div>`;
            actionsHtml = `<button id="retry-level-btn" class="btn btn-primary">Retry Level ${quizContext.level}</button>`;
        }
    }

    const reviewHtml = quizData.map((q, index) => {
        const userAnswerIndex = userAnswers[index];
        const isCorrect = userAnswerIndex === q.correctAnswerIndex;
        return `
            <div class="review-item" style="animation-delay: ${index * 0.15}s">
                <p class="review-question">${index + 1}. ${q.question}</p>
                <div class="review-options">
                    ${q.options.map((opt, i) => `
                        <div class="review-option ${i === q.correctAnswerIndex ? 'review-correct' : (i === userAnswerIndex ? 'review-incorrect' : '')}">
                            ${opt}
                        </div>
                    `).join('')}
                </div>
                ${!isCorrect ? `<div class="review-explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
            </div>
        `;
    }).join('');

    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

    resultsContainer.innerHTML = `
        <h2 class="results-title">Quiz Complete!</h2>
        <div class="score-container">
            <svg class="score-circle" width="120" height="120" viewBox="0 0 120 120">
                <circle class="score-circle-bg" cx="60" cy="60" r="54" stroke-width="12"></circle>
                <circle id="score-fg" class="score-circle-fg" cx="60" cy="60" r="54" stroke-width="12"
                    stroke="url(#score-gradient)"
                    stroke-dasharray="${circumference}">
                </circle>
                <defs>
                    <linearGradient id="score-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="${scorePercentage < 50 ? 'var(--color-warning)' : 'var(--color-secondary)'}" />
                        <stop offset="100%" stop-color="${scorePercentage < 50 ? 'var(--color-danger)' : 'var(--color-primary)'}" />
                    </linearGradient>
                </defs>
            </svg>
            <div id="score-text" class="score-text">0/${quizData.length}</div>
        </div>
        <p class="results-summary">You scored ${scorePercentage}%</p>
        ${feedbackHtml}
        <div class="results-actions">
            ${actionsHtml}
            <button id="back-to-topics-btn" class="btn btn-secondary">Back to Topics</button>
        </div>
        <div class="review-container">${reviewHtml}</div>
    `;

    // Trigger animations
    const scoreTextEl = document.getElementById('score-text');
    const scoreFgCircle = document.getElementById('score-fg');
    setTimeout(() => {
        scoreFgCircle.style.strokeDashoffset = strokeDashoffset;
        animateCountUp(scoreTextEl, score, quizData.length);
    }, 100);

    document.getElementById('back-to-topics-btn')?.addEventListener('click', handleBackToTopics);
    document.getElementById('next-level-btn')?.addEventListener('click', handleNextLevel);
    document.getElementById('retry-level-btn')?.addEventListener('click', handleRetryLevel);
}

function handleBackToTopics() {
    window.location.hash = quizContext.returnHash || '#home';
}

function handleRetryLevel() {
    const topicName = quizContext.topicName;
    const level = quizContext.level;
    const returnHash = quizContext.returnHash;
    const prompt = quizContext.prompt; // For non-leveled quizzes

    if (quizContext.isLeveled === false) {
        sessionStorage.setItem('quizContext', JSON.stringify({ topicName, isLeveled: false, prompt, returnHash }));
        sessionStorage.setItem('quizTopicPrompt', prompt);
    } else {
        const descriptor = getLevelDescriptor(level); // You'll need to copy this helper function
        const newPrompt = `Generate a quiz with ${quizData.length} multiple-choice questions about "${topicName}". The difficulty should be for an expert at Level ${level} out of ${MAX_LEVEL} (${descriptor} level). Ensure all questions are unique and cover different aspects of the topic.`;
        sessionStorage.setItem('quizContext', JSON.stringify({ topicName, level, returnHash }));
        sessionStorage.setItem('quizTopicPrompt', newPrompt);
    }
    
    sessionStorage.setItem('quizTopicName', topicName);
    window.location.hash = '#loading';
}

function handleNextLevel() {
    const level = quizContext.level + 1;
    const topicName = quizContext.topicName;
    const returnHash = quizContext.returnHash;
    const descriptor = getLevelDescriptor(level);
    const prompt = `Generate a quiz with ${quizData.length} multiple-choice questions about "${topicName}". The difficulty should be for an expert at Level ${level} out of ${MAX_LEVEL} (${descriptor} level). Ensure all questions are unique and cover different aspects of the topic.`;

    sessionStorage.setItem('quizContext', JSON.stringify({ topicName, level, returnHash }));
    sessionStorage.setItem('quizTopicPrompt', prompt);
    sessionStorage.setItem('quizTopicName', topicName);
    window.location.hash = '#loading';
}

function getLevelDescriptor(level) {
    const descriptors = { 1: "Noob", 10: "Beginner", 20: "Intermediate", 30: "Advanced", 40: "Expert", 50: "Master" };
    const keys = Object.keys(descriptors).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
        if (level >= key) return descriptors[key];
    }
    return "Noob";
}

function init() {
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
        renderResults();
    } catch (e) {
        console.error("Failed to parse results data:", e);
        window.location.hash = '#home';
    } finally {
        sessionStorage.removeItem('quizResults');
    }
}

init();