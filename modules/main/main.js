import { generateQuiz } from '../welcome/services/geminiService.js';
import { NUM_QUESTIONS, UNLOCK_SCORE, MAX_LEVEL } from '../../constants.js';
import * as quizStateService from '../../services/quizStateService.js';
import * as progressService from '../../services/progressService.js';

// --- State ---
let quizData = null;
let userAnswers = [];
let currentQuestionIndex = 0;

// --- DOM Elements ---
const views = {
    topicSelector: document.getElementById('topic-selector-view'),
    loading: document.getElementById('loading-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view'),
    resumePrompt: document.getElementById('resume-prompt-view'),
};
const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const errorMessage = document.getElementById('error-message');
const resumeBtn = document.getElementById('resume-btn');
const startNewBtn = document.getElementById('start-new-btn');


// --- Functions ---

function updateView(currentViewKey) {
    Object.entries(views).forEach(([key, view]) => {
        if (view) view.classList.toggle('hidden', key !== currentViewKey);
    });
}

function saveCurrentState() {
    if (!quizData) return;
    const state = {
        quizData,
        userAnswers,
        currentQuestionIndex
    };
    quizStateService.saveQuizState(state);
}

function startSpecificQuiz(topic, level, returnHash, category) {
    let prompt = '';
    // Reconstruct the prompt based on the category
    if (category === 'programming') {
        prompt = `Generate a quiz on the ${topic} programming language. The difficulty should be level ${level} out of ${MAX_LEVEL}, where level 1 is for an absolute beginner (noob) and level ${MAX_LEVEL} is for a world-class expert. Adjust the complexity, depth, and obscurity of the questions accordingly.`;
    } else if (category === 'history') {
        prompt = `Generate a quiz on the key events, figures, and concepts of ${topic}. The difficulty should be level ${level} out of ${MAX_LEVEL}, where level 1 is for an absolute beginner (noob) and level ${MAX_LEVEL} is for a world-class expert. Adjust the complexity, depth, and obscurity of the questions accordingly.`;
    } else {
         // Generic prompt for other categories
         prompt = `Generate a quiz on ${topic} at difficulty level ${level}/${MAX_LEVEL}.`;
    }

    sessionStorage.setItem('quizTopicPrompt', prompt);
    sessionStorage.setItem('quizTopicName', topic);
    sessionStorage.setItem('quizLevel', level);
    sessionStorage.setItem('quizReturnHash', returnHash);
    sessionStorage.setItem('quizCategory', category);
    
    window.location.hash = '#loading';
}


function renderQuiz() {
    const question = quizData[currentQuestionIndex];
    const optionsHtml = question.options.map((option, index) =>
        `<button data-option-index="${index}" class="quiz-option">${option}</button>`
    ).join('');

    views.quiz.innerHTML = `
        <div id="question-content" style="animation: fadeIn 0.5s ease;">
            <div class="progress-bar">
                <div class="progress-bar-inner" style="width: ${((currentQuestionIndex + 1) / NUM_QUESTIONS) * 100}%"></div>
            </div>
            <p class="question-header">Question ${currentQuestionIndex + 1} of ${NUM_QUESTIONS}</p>
            <h3 class="question-text">${question.question}</h3>
            <div class="options-grid">${optionsHtml}</div>
            <div id="quiz-feedback"></div>
        </div>
    `;

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.addEventListener('click', handleAnswerSelect);
    });
}

function renderResults() {
    const score = userAnswers.reduce((acc, answer, index) =>
        (answer === quizData[index].correctAnswerIndex ? acc + 1 : acc), 0
    );
    const scorePercentage = Math.round((score / quizData.length) * 100);

    // Retrieve quiz context for progression logic
    const topicName = sessionStorage.getItem('quizTopicName');
    const level = parseInt(sessionStorage.getItem('quizLevel'), 10);
    const returnHash = sessionStorage.getItem('quizReturnHash');
    const category = sessionStorage.getItem('quizCategory');

    let resultsMessage = '';
    let actionButtonsHtml = '';

    if (score >= UNLOCK_SCORE) {
        const isMaxLevel = level >= MAX_LEVEL;
        resultsMessage = isMaxLevel 
            ? `<p class="results-feedback success">Mastery! You've completed all levels for ${topicName}!</p>`
            : `<p class="results-feedback success">Congratulations! You've unlocked Level ${level + 1}.</p>`;

        if (!isMaxLevel) {
            progressService.unlockNextLevel(topicName, MAX_LEVEL);
            actionButtonsHtml = `<button id="next-level-btn" class="btn btn-primary">Play Level ${level + 1}</button>`;
        }
    } else {
        resultsMessage = `<p class="results-feedback failure">Almost there! You need a score of ${UNLOCK_SCORE} or more to unlock the next level.</p>`;
        actionButtonsHtml = `<button id="retry-level-btn" class="btn btn-primary">Retry Level ${level}</button>`;
    }
    actionButtonsHtml += `<a href="${returnHash}" class="btn btn-secondary">Back to Topics</a>`;


    const getResultColor = () => {
        if (scorePercentage >= 80) return 'var(--color-success)';
        if (scorePercentage >= 50) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };
    
    const strokeColor = getResultColor();
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

    const questionsReviewHtml = quizData.map((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswerIndex;
        
        const optionsHtml = question.options.map((option, optIndex) => {
            let itemClass = '';
            if (optIndex === question.correctAnswerIndex) itemClass = 'review-correct';
            else if (optIndex === userAnswer) itemClass = 'review-incorrect';
            return `<div class="review-option ${itemClass}">${option}</div>`;
        }).join('');
        
        return `
            <div class="review-item">
                <h4 class="review-question">${index + 1}. ${question.question}</h4>
                <div class="review-options">${optionsHtml}</div>
                ${!isCorrect ? `<p class="review-explanation"><strong>Explanation:</strong> ${question.explanation}</p>` : ''}
            </div>
        `;
    }).join('');

    views.results.innerHTML = `
        <div style="animation: fadeIn 0.5s ease;">
            <h2 class="results-title">Quiz Complete!</h2>
            <div class="score-container">
                <svg class="score-circle" viewBox="0 0 120 120">
                    <circle class="score-circle-bg" cx="60" cy="60" r="54" />
                    <circle class="score-circle-fg" cx="60" cy="60" r="54" stroke="${strokeColor}" stroke-width="12" stroke-dasharray="${circumference}" style="stroke-dashoffset: ${strokeDashoffset}" />
                </svg>
                <div class="score-text" style="color:${strokeColor}">${scorePercentage}%</div>
            </div>
            <p class="results-summary">You answered ${score} out of ${quizData.length} questions correctly.</p>
            ${resultsMessage}
            <div class="results-actions">${actionButtonsHtml}</div>
            <div class="review-container" style="margin-top: 2rem;">${questionsReviewHtml}</div>
        </div>
    `;
    
    // Add event listeners for new buttons
    document.getElementById('next-level-btn')?.addEventListener('click', () => {
        startSpecificQuiz(topicName, level + 1, returnHash, category);
    });
    document.getElementById('retry-level-btn')?.addEventListener('click', () => {
        startSpecificQuiz(topicName, level, returnHash, category);
    });
}


// --- Event Handlers ---

function handleStartQuiz(e) {
    e.preventDefault();
    const topic = topicInput.value.trim();
    if (!topic) return;

    sessionStorage.setItem('quizTopicPrompt', `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}".`);
    sessionStorage.setItem('quizTopicName', topic); // Generic topic name
    sessionStorage.setItem('quizLevel', 1); // Default to level 1
    sessionStorage.setItem('quizReturnHash', '#quiz'); // Return to the generic quiz page
    sessionStorage.setItem('quizCategory', 'generic');
    
    window.location.hash = '#loading';
}

function handleAnswerSelect(e) {
    const selectedButton = e.currentTarget;
    const selectedAnswerIndex = parseInt(selectedButton.dataset.optionIndex, 10);
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;
    saveCurrentState();

    const question = quizData[currentQuestionIndex];
    const correctIndex = question.correctAnswerIndex;

    document.querySelectorAll('.quiz-option').forEach((button, index) => {
        button.disabled = true;
        if (index === correctIndex) button.classList.add('correct');
        else if (index === selectedAnswerIndex) button.classList.add('incorrect');
        else button.classList.add('faded');
    });

    // Automatically proceed to the next question after a delay
    setTimeout(handleNext, 1800);
}

function handleNext() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        saveCurrentState();
        renderQuiz();
    } else {
        quizStateService.clearQuizState();
        updateView('results');
        renderResults();
    }
}

function handleRestart() {
    quizStateService.clearQuizState();
    quizData = null;
    userAnswers = [];
    currentQuestionIndex = 0;
    if (topicInput) topicInput.value = '';
    if (errorMessage) errorMessage.textContent = '';
    updateView('topicSelector');
}

function handleResume() {
    const savedState = quizStateService.loadQuizState();
    if (savedState) {
        quizData = savedState.quizData;
        userAnswers = savedState.userAnswers;
        currentQuestionIndex = savedState.currentQuestionIndex;
        updateView('quiz');
        renderQuiz();
    }
}


// --- Initialization ---
function init() {
    if (topicForm) {
        topicForm.addEventListener('submit', handleStartQuiz);
    }
    if (resumeBtn && startNewBtn) {
        resumeBtn.addEventListener('click', handleResume);
        startNewBtn.addEventListener('click', handleRestart);
    }

    const quizDataString = sessionStorage.getItem('generatedQuizData');
    const errorString = sessionStorage.getItem('quizError');

    if (quizDataString) {
        sessionStorage.removeItem('generatedQuizData');
        try {
            const data = JSON.parse(quizDataString);
            quizData = data;
            userAnswers = new Array(data.length).fill(null);
            currentQuestionIndex = 0;
            saveCurrentState();
            updateView('quiz');
            renderQuiz();
        } catch (e) {
            console.error("Failed to parse quiz data:", e);
            if (errorMessage) errorMessage.textContent = "There was an error loading the quiz data.";
            updateView('topicSelector');
        }
    } else if (errorString) {
        const returnHash = sessionStorage.getItem('quizReturnHash') || '#quiz';
        sessionStorage.removeItem('quizError');
        // If we are on the #quiz page, show the error. Otherwise, just go back.
        if(window.location.hash === '#quiz' && errorMessage) {
            errorMessage.textContent = errorString;
            updateView('topicSelector');
        } else {
            window.location.hash = returnHash;
        }

    } else if (quizStateService.hasSavedState()) {
        updateView('resumePrompt');
    }
    else {
        updateView('topicSelector');
    }
}

init();
