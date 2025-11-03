import { generateQuiz } from '../welcome/services/geminiService.js';
import { NUM_QUESTIONS } from '../../constants.js';
import * as quizStateService from '../../services/quizStateService.js';

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
            <div class="review-container">${questionsReviewHtml}</div>
            <button id="restart-btn" class="btn btn-primary">Try Another Quiz</button>
        </div>
    `;

    document.getElementById('restart-btn').addEventListener('click', handleRestart);
}


// --- Event Handlers ---

function handleStartQuiz(e) {
    e.preventDefault();
    const topic = topicInput.value.trim();
    if (!topic) return;

    sessionStorage.setItem('quizTopic', topic);
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

    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    document.getElementById('quiz-feedback').innerHTML = `
        <button id="next-btn" class="btn btn-primary" style="margin-top: 1rem; animation: fadeIn 0.3s ease;">
            ${isLastQuestion ? 'Finish Quiz' : 'Next Question'}
        </button>
    `;
    document.getElementById('next-btn').addEventListener('click', handleNext);
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
        sessionStorage.removeItem('quizError');
        if (errorMessage) errorMessage.textContent = errorString;
        updateView('topicSelector');
    } else if (quizStateService.hasSavedState()) {
        updateView('resumePrompt');
    }
    else {
        updateView('topicSelector');
    }
}

init();