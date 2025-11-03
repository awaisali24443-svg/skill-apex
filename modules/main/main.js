import { generateQuiz } from '../welcome/services/geminiService.js';
import * as quizState from '../../services/quizStateService.js';
import * as progressService from '../../services/progressService.js';
import { NUM_QUESTIONS, UNLOCK_SCORE, MAX_LEVEL } from '../../constants.js';
import { playSound } from '../../services/soundService.js';

// --- Game State ---
const GameView = {
    RESUME_PROMPT: 'RESUME_PROMPT',
    TOPIC_SELECTION: 'TOPIC_SELECTION',
    QUIZ: 'QUIZ',
    RESULTS: 'RESULTS'
};

let currentView = GameView.TOPIC_SELECTION;
let quizData = null;
let userAnswers = [];
let currentQuestionIndex = 0;
let quizContext = {}; // Will hold topicName, level, returnHash

// --- DOM Elements ---
const views = {};

// --- Helper Functions ---
function getLevelDescriptor(level) {
    const descriptors = { 1: "Noob", 10: "Beginner", 20: "Intermediate", 30: "Advanced", 40: "Expert", 50: "Master" };
    const keys = Object.keys(descriptors).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
        if (level >= key) return descriptors[key];
    }
    return "Noob";
}

function updateView() {
    Object.values(views).forEach(view => view?.classList.add('hidden'));
    const viewElement = views[currentView];
    if (viewElement) {
        viewElement.classList.remove('hidden');
    } else {
        console.error(`View element for state "${currentView}" not found.`);
    }
}

// --- Render Functions ---
function renderQuiz() {
    if (!quizData || !quizData[currentQuestionIndex]) {
        handleError("Quiz data is missing or invalid.");
        return;
    }

    const question = quizData[currentQuestionIndex];
    const optionsHtml = question.options.map((option, index) => `
        <button data-option-index="${index}" class="quiz-option">
            ${option}
        </button>
    `).join('');

    views.QUIZ.innerHTML = `
        <div class="progress-bar">
            <div class="progress-bar-inner" style="width: ${((currentQuestionIndex + 1) / quizData.length) * 100}%"></div>
        </div>
        <div class="question-header">
            <span>Question ${currentQuestionIndex + 1} / ${quizData.length}</span>
            <span>${quizContext.topicName || ''} - Level ${quizContext.level || ''}</span>
        </div>
        <h2 class="question-text">${question.question}</h2>
        <div class="options-grid">${optionsHtml}</div>
        <div id="quiz-feedback"></div>
    `;

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.addEventListener('click', handleAnswerSelect);
    });
}

function renderResults() {
    playSound('complete');
    const score = userAnswers.reduce((acc, answer, index) => 
        (answer === quizData[index].correctAnswerIndex ? acc + 1 : acc), 0);
    
    progressService.recordQuizResult(score, quizData.length);

    const scorePercentage = Math.round((score / quizData.length) * 100);
    
    // Level Progression Logic
    const didPass = score >= UNLOCK_SCORE;
    const isMaxLevel = quizContext.level >= MAX_LEVEL;
    let feedbackHtml = '';
    let actionsHtml = '';

    if (didPass) {
        if (!isMaxLevel) {
            const newLevel = quizContext.level + 1;
            feedbackHtml = `
                <div class="results-feedback success">
                    <strong>Level ${quizContext.level} Passed!</strong> You've unlocked Level ${newLevel}.
                </div>`;
            actionsHtml = `<button id="next-level-btn" class="btn btn-primary">Play Next Level</button>`;
            progressService.unlockNextLevel(quizContext.topicName, MAX_LEVEL);
        } else {
            feedbackHtml = `
                <div class="results-feedback success">
                    <strong>Congratulations!</strong> You've mastered ${quizContext.topicName} by completing the final level!
                </div>`;
        }
    } else {
        feedbackHtml = `
            <div class="results-feedback failure">
                <strong>Nice try!</strong> You need a score of at least ${UNLOCK_SCORE} to unlock the next level.
            </div>`;
        actionsHtml = `<button id="retry-level-btn" class="btn btn-primary">Retry Level ${quizContext.level}</button>`;
    }

    const reviewHtml = quizData.map((q, index) => {
        const userAnswerIndex = userAnswers[index];
        const isCorrect = userAnswerIndex === q.correctAnswerIndex;
        return `
            <div class="review-item">
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

    const circumference = 2 * Math.PI * 54; // r=54 for a 120px circle with 6px stroke
    const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

    views.RESULTS.innerHTML = `
        <h2 class="results-title">Quiz Complete!</h2>
        <div class="score-container">
            <svg class="score-circle" width="120" height="120" viewBox="0 0 120 120">
                <circle class="score-circle-bg" cx="60" cy="60" r="54" stroke-width="12"></circle>
                <circle class="score-circle-fg" cx="60" cy="60" r="54" stroke-width="12"
                    stroke="url(#score-gradient)"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${strokeDashoffset}">
                </circle>
                <defs>
                    <linearGradient id="score-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="${scorePercentage < 50 ? 'var(--color-warning)' : 'var(--color-secondary)'}" />
                        <stop offset="100%" stop-color="${scorePercentage < 50 ? 'var(--color-danger)' : 'var(--color-primary)'}" />
                    </linearGradient>
                </defs>
            </svg>
            <div class="score-text">${score}/${quizData.length}</div>
        </div>
        <p class="results-summary">You scored ${scorePercentage}%</p>
        ${feedbackHtml}
        <div class="results-actions">
            ${actionsHtml}
            <button id="back-to-topics-btn" class="btn btn-secondary">Back to Topics</button>
        </div>
        <div class="review-container">${reviewHtml}</div>
    `;

    document.getElementById('back-to-topics-btn')?.addEventListener('click', handleBackToTopics);
    document.getElementById('next-level-btn')?.addEventListener('click', handleNextLevel);
    document.getElementById('retry-level-btn')?.addEventListener('click', handleRetryLevel);
}


// --- Event Handlers ---
function handleAnswerSelect(e) {
    const selectedButton = e.currentTarget;
    const selectedAnswerIndex = parseInt(selectedButton.dataset.optionIndex, 10);
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = quizData[currentQuestionIndex];
    const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;
    playSound(isCorrect ? 'correct' : 'incorrect');

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.disabled = true;
        const index = parseInt(button.dataset.optionIndex, 10);
        if (index === question.correctAnswerIndex) {
            button.classList.add('correct');
        } else if (index === selectedAnswerIndex) {
            button.classList.add('incorrect');
        } else {
            button.classList.add('faded');
        }
    });

    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    document.getElementById('quiz-feedback').innerHTML = `
        <button id="next-btn" class="btn btn-primary">${isLastQuestion ? 'Finish Quiz' : 'Next Question'}</button>
    `;
    document.getElementById('next-btn').addEventListener('click', handleNext);

    quizState.saveQuizState({ quizData, userAnswers, currentQuestionIndex, quizContext });
}

function handleNext() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        renderQuiz();
    } else {
        currentView = GameView.RESULTS;
        updateView();
        renderResults();
        quizState.clearQuizState();
    }
}

function handleBackToTopics() {
    window.location.hash = quizContext.returnHash || '#home';
}

function handleRetryLevel() {
    startQuiz(quizContext.topicName, quizContext.level);
}

function handleNextLevel() {
    startQuiz(quizContext.topicName, quizContext.level + 1);
}

function startQuiz(topicName, level) {
    const descriptor = getLevelDescriptor(level);
    const context = {
        topicName,
        level,
        returnHash: quizContext.returnHash || '#home'
    };
    sessionStorage.setItem('quizContext', JSON.stringify(context));
    
    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be for an expert at Level ${level} out of ${MAX_LEVEL} (${descriptor} level).`;
    sessionStorage.setItem('quizTopicPrompt', prompt);
    sessionStorage.setItem('quizTopicName', topicName);
    
    window.location.hash = '#loading';
}


function handleError(message, shouldClearState = false) {
    console.error(message);
    const errorElement = views.TOPIC_SELECTION?.querySelector('.error-text');
    if(errorElement) errorElement.textContent = message;
    
    currentView = GameView.TOPIC_SELECTION;
    updateView();
    
    if (shouldClearState) {
        quizState.clearQuizState();
        sessionStorage.removeItem('quizError');
    }
}

async function startNewQuiz() {
    const error = sessionStorage.getItem('quizError');
    if (error) {
        handleError(error, true);
        return;
    }
    
    const dataString = sessionStorage.getItem('generatedQuizData');
    if (!dataString) {
        // This can happen if the user reloads on the quiz page.
        // We direct them back to their topic selection.
        const storedContextString = sessionStorage.getItem('quizContext');
        const storedContext = storedContextString ? JSON.parse(storedContextString) : null;
        if(storedContext && storedContext.returnHash) {
            window.location.hash = storedContext.returnHash;
        } else {
            window.location.hash = '#home';
        }
        return;
    }
    
    try {
        quizData = JSON.parse(dataString);
        userAnswers = new Array(quizData.length).fill(null);
        currentQuestionIndex = 0;
        
        const contextString = sessionStorage.getItem('quizContext');
        if (!contextString) throw new Error("Quiz context is missing.");
        quizContext = JSON.parse(contextString);

        currentView = GameView.QUIZ;
        updateView();
        renderQuiz();

        // Save initial state for resuming
        quizState.saveQuizState({ quizData, userAnswers, currentQuestionIndex, quizContext });

        // Clean up session storage
        sessionStorage.removeItem('generatedQuizData');
        sessionStorage.removeItem('quizError');

    } catch (err) {
        handleError("Failed to start the quiz. The quiz data was invalid.", true);
    }
}

// --- Initialization ---
function init() {
    // Cache view elements
    views.RESUME_PROMPT = document.getElementById('resume-prompt-view');
    views.TOPIC_SELECTION = document.getElementById('topic-selector-view');
    views.QUIZ = document.getElementById('quiz-view');
    views.RESULTS = document.getElementById('results-view');
    
    if (quizState.hasSavedState()) {
        const saved = quizState.loadQuizState();
        quizData = saved.quizData;
        userAnswers = saved.userAnswers;
        currentQuestionIndex = saved.currentQuestionIndex;
        quizContext = saved.quizContext;
        
        currentView = GameView.QUIZ;
        updateView();
        renderQuiz();
    } else {
        startNewQuiz();
    }
}

// Run initialization logic
init();
