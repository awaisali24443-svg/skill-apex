import * as quizState from '../../services/quizStateService.js';
import { playSound } from '../../services/soundService.js';

let quizData = null;
let userAnswers = [];
let currentQuestionIndex = 0;
let quizContext = {};

let autoAdvanceTimer = null;
let countdownInterval = null;
let isTimerPaused = false;
let countdownValue = 3;

const quizContainer = document.getElementById('quiz-container');

const motivationalHints = [
    "You’re doing great!", "This next one’s a brain-twister!", "Keep up the awesome work!",
    "One step closer to mastery!", "Let's see how you handle this one.", "Knowledge is power!"
];

const handleKeyPress = (e) => {
    const key = parseInt(e.key, 10);
    if (key >= 1 && key <= 4) {
        const optionButtons = document.querySelectorAll('.quiz-option');
        const targetButton = optionButtons[key - 1];
        if (targetButton && !targetButton.disabled) {
            targetButton.click();
        }
    }
};

async function renderQuiz() {
    if (!quizData || !quizData[currentQuestionIndex]) {
        handleError("Quiz data is missing or invalid. Returning to safety.", true);
        return;
    }

    const question = quizData[currentQuestionIndex];
    const optionsHtml = question.options.map((option, index) => `
        <button data-option-index="${index}" class="quiz-option">
           <span>${index + 1}.</span> ${option}
        </button>
    `).join('');
    
    const hint = currentQuestionIndex > 0 ? motivationalHints[Math.floor(Math.random() * motivationalHints.length)] : '';

    const newContent = document.createElement('div');
    newContent.id = 'quiz-content-wrapper';
    newContent.innerHTML = `
        <div class="progress-bar">
            <div class="progress-bar-inner" style="width: ${((currentQuestionIndex + 1) / quizData.length) * 100}%"></div>
        </div>
        <div class="question-header">
            <span>Question ${currentQuestionIndex + 1} / ${quizData.length}</span>
            <span>${quizContext.topicName || ''} ${quizContext.isLeveled === false ? '' : `- Level ${quizContext.level || ''}`}</span>
        </div>
        <div class="motivational-hint">${hint}</div>
        <h2 class="question-text">${question.question}</h2>
        <div class="options-grid">${optionsHtml}</div>
        <div id="quiz-feedback"></div>
    `;
    
    const oldContent = quizContainer.querySelector('#quiz-content-wrapper');
    if (oldContent) {
        oldContent.classList.add('exiting');
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    quizContainer.innerHTML = '';
    quizContainer.appendChild(newContent);

    document.querySelectorAll('.quiz-option').forEach(button => {
        button.addEventListener('click', handleAnswerSelect);
    });
}

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
    const feedbackContainer = document.getElementById('quiz-feedback');
    
    let timerControls = '';
    if (!isLastQuestion) {
        timerControls = `
            <button id="timer-control-btn" class="timer-control-btn" aria-label="Pause auto-advance">❚❚</button>
            <span class="countdown"></span>
        `;
    }

    feedbackContainer.innerHTML = `
        <button id="next-btn" class="btn btn-primary">${isLastQuestion ? 'Finish Quiz' : 'Next Question'}</button>
        ${timerControls}
    `;
    
    const nextBtn = document.getElementById('next-btn');
    nextBtn.addEventListener('click', handleNext);
    document.getElementById('timer-control-btn')?.addEventListener('click', toggleTimer);

    if (!isLastQuestion) {
        startAutoAdvance();
    }

    quizState.saveQuizState({ quizData, userAnswers, currentQuestionIndex, quizContext });
}

function startAutoAdvance() {
    clearTimeout(autoAdvanceTimer);
    clearInterval(countdownInterval);
    
    isTimerPaused = false;
    countdownValue = 3;
    
    const countdownSpan = document.querySelector('.countdown');
    const timerBtn = document.getElementById('timer-control-btn');
    
    if (!countdownSpan || !timerBtn) return;

    timerBtn.innerHTML = '❚❚';
    timerBtn.setAttribute('aria-label', 'Pause auto-advance');
    
    const updateCountdown = () => {
        if(countdownValue < 0) return;
        countdownSpan.textContent = `(${countdownValue})`;
        countdownValue--;
    };
    
    updateCountdown(); // Initial display
    countdownInterval = setInterval(updateCountdown, 1000);
    autoAdvanceTimer = setTimeout(handleNext, 3000);
}

function toggleTimer() {
    const timerBtn = document.getElementById('timer-control-btn');
    if (!timerBtn) return;

    isTimerPaused = !isTimerPaused;

    if (isTimerPaused) {
        clearTimeout(autoAdvanceTimer);
        clearInterval(countdownInterval);
        timerBtn.innerHTML = '▶';
        timerBtn.setAttribute('aria-label', 'Resume auto-advance');
    } else { // Resuming
        timerBtn.innerHTML = '❚❚';
        timerBtn.setAttribute('aria-label', 'Pause auto-advance');
        
        if (countdownValue < 0) countdownValue = 0;

        autoAdvanceTimer = setTimeout(handleNext, countdownValue * 1000);
        
        const countdownSpan = document.querySelector('.countdown');
        if (countdownSpan) {
             const updateCountdown = () => {
                if(countdownValue < 0) return;
                countdownSpan.textContent = `(${countdownValue})`;
                countdownValue--;
            };
            updateCountdown();
            countdownInterval = setInterval(updateCountdown, 1000);
        }
    }
}


function handleNext() {
    clearTimeout(autoAdvanceTimer);
    clearInterval(countdownInterval);

    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        renderQuiz();
    } else {
        sessionStorage.setItem('quizResults', JSON.stringify({
            quizData, userAnswers, quizContext
        }));
        quizState.clearQuizState();
        window.location.hash = '#results';
    }
}

function handleError(message, shouldClearState = false) {
    console.error(message);
    window.showToast(message, 'error');
    if (shouldClearState) {
        quizState.clearQuizState();
    }
    window.location.hash = '#home';
}

function init() {
    const savedState = quizState.loadQuizState();

    if (savedState) {
        quizData = savedState.quizData;
        userAnswers = savedState.userAnswers;
        currentQuestionIndex = savedState.currentQuestionIndex;
        quizContext = savedState.quizContext;
        renderQuiz();
    } else {
        handleError("No active quiz found. Please select a topic to start.", false);
        return;
    }
    
    document.addEventListener('keydown', handleKeyPress);
}

window.addEventListener('hashchange', () => {
    document.removeEventListener('keydown', handleKeyPress);
    clearTimeout(autoAdvanceTimer);
    clearInterval(countdownInterval);
}, { once: true });

init();