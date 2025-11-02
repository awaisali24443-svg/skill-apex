import { generateQuiz } from '../../geminiService.js';

// --- Constants ---
const NUM_QUESTIONS = 5;

// --- State ---
let quizData = null;
let userAnswers = [];
let currentQuestionIndex = 0;

// --- DOM Elements ---
const views = {
    loading: document.getElementById('loading-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view'),
};
const quizContainer = document.getElementById('quiz-container');

// --- UI Rendering ---

function updateView(currentView) {
    Object.entries(views).forEach(([key, view]) => {
        if (view) {
            view.classList.toggle('hidden', key !== currentView);
        }
    });
}

function renderQuiz() {
    const question = quizData[currentQuestionIndex];
    const optionsHtml = question.options.map((option, index) =>
        `<button data-option-index="${index}" class="quiz-option">
            <span class="option-text">${option}</span>
            <span class="option-icon"></span>
        </button>`
    ).join('');

    views.quiz.innerHTML = `
        <div id="question-content" class="fade-in">
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-bar-inner" style="width: ${((currentQuestionIndex + 1) / NUM_QUESTIONS) * 100}%"></div>
                </div>
            </div>
            <div class="question-header">
                <span>Question ${currentQuestionIndex + 1} / ${NUM_QUESTIONS}</span>
            </div>
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
    const circumference = 2 * Math.PI * 54; // 2 * pi * radius
    const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

    const questionsReviewHtml = quizData.map((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswerIndex;
        
        const optionsHtml = question.options.map((option, optIndex) => {
            let itemClass = '';
            if (optIndex === question.correctAnswerIndex) {
                itemClass = 'review-correct';
            } else if (optIndex === userAnswer) {
                itemClass = 'review-incorrect';
            }
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
        <div class="fade-in">
            <h2 class="results-title">Quiz Complete!</h2>
            <div class="score-container">
                <svg class="score-circle" viewBox="0 0 120 120">
                    <circle class="score-circle-bg" cx="60" cy="60" r="54" />
                    <circle 
                        class="score-circle-fg" 
                        cx="60" 
                        cy="60" 
                        r="54" 
                        stroke="${strokeColor}"
                        stroke-width="12"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${strokeDashoffset}"
                    />
                </svg>
                <div class="score-text" style="color:${strokeColor}">${scorePercentage}%</div>
            </div>
            <p class="results-summary">You answered ${score} out of ${quizData.length} questions correctly.</p>
            <div class="review-container">${questionsReviewHtml}</div>
            <button id="restart-btn" class="btn btn-primary">Try Another Quiz</button>
        </div>
    `;

    document.getElementById('restart-btn').addEventListener('click', () => {
        window.location.hash = '#optional-quiz';
    });
}

function renderError(message) {
    if (quizContainer) {
        quizContainer.innerHTML = `
            <div class="fade-in" style="text-align: center;">
                <h2 style="color:var(--color-danger); margin-bottom: 1rem;">Oops! Something went wrong.</h2>
                <p style="color:var(--color-text-muted); margin-bottom: 2rem;">${message}</p>
                <a href="#optional-quiz" class="btn btn-primary">Try a Different Topic</a>
            </div>
        `;
    }
}

// --- Event Handlers ---

function handleAnswerSelect(e) {
    const selectedButton = e.currentTarget;
    const selectedAnswerIndex = parseInt(selectedButton.dataset.optionIndex, 10);
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = quizData[currentQuestionIndex];
    const correctIndex = question.correctAnswerIndex;
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const crossIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    document.querySelectorAll('.quiz-option').forEach((button, index) => {
        button.disabled = true;
        const iconContainer = button.querySelector('.option-icon');
        
        if (index === correctIndex) {
            button.classList.add('correct');
            iconContainer.innerHTML = checkIcon;
        } else if (index === selectedAnswerIndex) {
            button.classList.add('incorrect');
            iconContainer.innerHTML = crossIcon;
        } else {
            button.classList.add('faded');
        }
    });

    const feedbackDiv = document.getElementById('quiz-feedback');
    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    feedbackDiv.innerHTML = `
        <button id="next-btn" class="btn btn-primary fade-in">
            ${isLastQuestion ? 'Finish Quiz' : 'Next Question'}
        </button>
    `;
    document.getElementById('next-btn').addEventListener('click', handleNext);
}

function handleNext() {
    const questionContent = document.getElementById('question-content');
    questionContent.classList.remove('fade-in');
    questionContent.classList.add('fade-out');

    setTimeout(() => {
        if (currentQuestionIndex < quizData.length - 1) {
            currentQuestionIndex++;
            renderQuiz();
        } else {
            updateView('results');
            renderResults();
        }
    }, 300); // Match animation duration
}

// --- Initialization ---

async function initMainModule() {
    const topic = sessionStorage.getItem('quizTopic');

    if (!topic) {
        renderError("No topic was selected. Please go back and choose a topic.");
        return;
    }

    try {
        updateView('loading');
        const data = await generateQuiz(topic, NUM_QUESTIONS);
        quizData = data;
        userAnswers = new Array(data.length).fill(null);
        currentQuestionIndex = 0;
        updateView('quiz');
        renderQuiz();
    } catch (err) {
        renderError(err.message);
    }
}

// Start the main quiz module
initMainModule();