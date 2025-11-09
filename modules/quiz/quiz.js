
import * as quizState from '../../services/quizStateService.js';
import { playSound } from '../../services/soundService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let state = null;
let challengeTimer;

const quizContainer = document.getElementById('quiz-container');

function renderQuizUI() {
    if (!state) return;
    const { quizData, currentQuestionIndex } = state;
    const question = quizData[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quizData.length) * 100;

    let timerHTML = '';
    if (state.quizContext.isChallenge) {
        timerHTML = `<div id="challenge-timer" class="challenge-timer">90s</div>`;
    }

    quizContainer.innerHTML = `
        <div class="quiz-header">
            ${timerHTML}
            <div class="quiz-topic">${state.quizContext.topicName}</div>
            <div class="quiz-progress-bar-container">
                <div class="quiz-progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="quiz-progress-text">Question ${currentQuestionIndex + 1} of ${quizData.length}</div>
        </div>
        <div class="quiz-body">
            <h2 class="quiz-question">${question.question}</h2>
            <div class="quiz-options">
                ${question.options.map((option, index) => `
                    <button class="quiz-option-btn" data-index="${index}">${option}</button>
                `).join('')}
            </div>
            <div id="quiz-feedback" class="quiz-feedback hidden">
                <p id="feedback-explanation"></p>
                <button id="next-question-btn" class="btn btn-primary">Next</button>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', handleAnswerSelection);
    });
}

function handleAnswerSelection(e) {
    const selectedIndex = parseInt(e.target.dataset.index, 10);
    state.userAnswers[state.currentQuestionIndex] = selectedIndex;
    quizState.saveQuizState(state); // Save progress

    const question = state.quizData[state.currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswerIndex;

    playSound(isCorrect ? 'correct' : 'incorrect');

    // Show feedback
    document.querySelectorAll('.quiz-option-btn').forEach((btn, index) => {
        btn.disabled = true;
        if (index === question.correctAnswerIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex) {
            btn.classList.add('incorrect');
        }
    });

    const feedbackEl = document.getElementById('quiz-feedback');
    document.getElementById('feedback-explanation').textContent = question.explanation;
    feedbackEl.classList.remove('hidden');
    
    document.getElementById('next-question-btn').focus();
    document.getElementById('next-question-btn').addEventListener('click', advanceQuiz, { once: true });
}

function advanceQuiz() {
    if (state.currentQuestionIndex < state.quizData.length - 1) {
        state.currentQuestionIndex++;
        quizState.saveQuizState(state);
        renderQuizUI();
    } else {
        // End of quiz
        endQuiz();
    }
}

function endQuiz() {
    if (challengeTimer) clearInterval(challengeTimer);
    window.location.hash = '#results';
}

function startChallengeTimer() {
    let timeLeft = 90;
    const timerEl = document.getElementById('challenge-timer');
    
    challengeTimer = setInterval(() => {
        timeLeft--;
        if (timerEl) {
            timerEl.textContent = `${timeLeft}s`;
            if (timeLeft <= 10) {
                timerEl.classList.add('low-time');
            }
        }
        if (timeLeft <= 0) {
            clearInterval(challengeTimer);
            window.showToast("Time's up!", 'error');
            endQuiz();
        }
    }, 1000);
}

function init() {
    state = quizState.loadQuizState();
    if (!state) {
        window.showToast("No active quiz found. Starting over.", "error");
        window.location.hash = '#home';
        return;
    }

    renderQuizUI();
    
    if (state.quizContext.isChallenge) {
        startChallengeTimer();
    }

    sceneManager = initModuleScene('.background-canvas', 'abstractHub');
}

function cleanup() {
    if (challengeTimer) clearInterval(challengeTimer);
    sceneManager = cleanupModuleScene(sceneManager);
}

// Use a more robust cleanup method for SPAs
const observer = new MutationObserver((mutationsList, obs) => {
    // If the quiz container is no longer in the DOM or is empty, clean up.
    const container = document.getElementById('quiz-container');
    if (!container || !container.hasChildNodes()) {
        cleanup();
        obs.disconnect(); // Stop observing once cleaned up
    }
});
observer.observe(document.getElementById('root-container'), { childList: true, subtree: true });


init();
