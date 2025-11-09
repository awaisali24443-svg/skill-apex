import * as quizState from '../../services/quizStateService.js';
import { playSound } from '../../services/soundService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let state = null;
let challengeTimer;
let quizContainer;

function renderQuizUI() {
    if (!state || !quizContainer) return;
    const { quizData, currentQuestionIndex } = state;
    const question = quizData[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / quizData.length) * 100;

    let timerHTML = state.quizContext.isChallenge ? `<div id="challenge-timer" class="challenge-timer">90s</div>` : '';

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
                ${question.options.map((option, index) => `<button class="quiz-option-btn" data-index="${index}">${option}</button>`).join('')}
            </div>
            <div id="quiz-feedback" class="quiz-feedback hidden">
                <p id="feedback-explanation"></p>
                <button id="next-question-btn" class="btn btn-primary">Next</button>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.addEventListener('click', handleAnswerSelection));
    if (state.quizContext.isChallenge) {
        startChallengeTimer();
    }
}

function handleAnswerSelection(e) {
    if (e.target.disabled) return;
    const selectedIndex = parseInt(e.target.dataset.index, 10);
    state.userAnswers[state.currentQuestionIndex] = selectedIndex;
    quizState.saveQuizState(state);

    const question = state.quizData[state.currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswerIndex;
    playSound(isCorrect ? 'correct' : 'incorrect');

    document.querySelectorAll('.quiz-option-btn').forEach((btn, index) => {
        btn.disabled = true;
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedIndex) btn.classList.add('incorrect');
    });

    const feedbackEl = document.getElementById('quiz-feedback');
    document.getElementById('feedback-explanation').textContent = question.explanation;
    feedbackEl.classList.remove('hidden');
    
    const nextBtn = document.getElementById('next-question-btn');
    nextBtn.focus();
    nextBtn.addEventListener('click', advanceQuiz, { once: true });
}

function advanceQuiz() {
    if (state.currentQuestionIndex < state.quizData.length - 1) {
        state.currentQuestionIndex++;
        quizState.saveQuizState(state);
        renderNextQuestion();
    } else {
        endQuiz();
    }
}

function renderNextQuestion() {
    const { quizData, currentQuestionIndex } = state;
    const question = quizData[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / quizData.length) * 100;
    
    document.querySelector('.quiz-progress-bar').style.width = `${progress}%`;
    document.querySelector('.quiz-progress-text').textContent = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;
    
    const quizBody = document.querySelector('.quiz-body');
    quizBody.innerHTML = `
        <h2 class="quiz-question">${question.question}</h2>
        <div class="quiz-options">
            ${question.options.map((option, index) => `<button class="quiz-option-btn" data-index="${index}">${option}</button>`).join('')}
        </div>
        <div id="quiz-feedback" class="quiz-feedback hidden">
            <p id="feedback-explanation"></p>
            <button id="next-question-btn" class="btn btn-primary">Next</button>
        </div>
    `;
    
    document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.addEventListener('click', handleAnswerSelection));
}


function endQuiz() {
    if (challengeTimer) clearInterval(challengeTimer);
    if (state.quizContext.isChallenge) {
        window.location.hash = '#challenge-results';
    } else {
        window.location.hash = '#results';
    }
}

function startChallengeTimer() {
    let timeLeft = 90;
    const timerEl = document.getElementById('challenge-timer');
    if (!timerEl) return;
    
    challengeTimer = setInterval(() => {
        timeLeft--;
        if (timerEl) {
            timerEl.textContent = `${timeLeft}s`;
            if (timeLeft <= 10) timerEl.classList.add('low-time');
        }
        if (timeLeft <= 0) {
            clearInterval(challengeTimer);
            window.showToast("Time's up!", "error");
            endQuiz();
        }
    }, 1000);
}

export function init() {
    quizContainer = document.getElementById('quiz-container');
    state = quizState.loadQuizState();
    if (!state) {
        window.showToast("No active quiz found. Starting over.", "error");
        window.location.hash = '#home';
        return;
    }
    renderQuizUI();
    sceneManager = initModuleScene('.background-canvas', 'abstractHub');
}

export function cleanup() {
    if (challengeTimer) clearInterval(challengeTimer);
    sceneManager = cleanupModuleScene(sceneManager);
    quizContainer = null;
    state = null;
}
