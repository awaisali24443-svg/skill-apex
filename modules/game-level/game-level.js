
import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as soundService from '../../services/soundService.js';
import * as historyService from '../../services/historyService.js';
import * as stateService from '../../services/stateService.js';
import * as firebaseService from '../../services/firebaseService.js';
import { showToast } from '../../services/toastService.js';

let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let levelContext = {};
let startTime = 0;
let cognitiveData = [];

async function startLevel() {
    const { topic, level } = levelContext;
    const data = await apiService.generateLevelQuestions({ topic, level });
    if (!data || !data.questions) {
        showToast("Neural link failed. Retrying...", "error");
        return window.history.back();
    }
    currentQuestions = data.questions;
    document.getElementById('level-loading-state').classList.remove('active');
    document.getElementById('level-quiz-state').classList.add('active');
    renderQuestion();
}

function renderQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    document.getElementById('quiz-question-text').textContent = q.question;
    const container = document.getElementById('quiz-options-container');
    container.innerHTML = '';
    
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(i);
        container.appendChild(btn);
    });

    const progress = ((currentQuestionIndex) / currentQuestions.length) * 100;
    document.getElementById('quiz-progress-bar-fill').style.width = `${progress}%`;
    document.getElementById('quiz-progress-text').textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
    
    startTime = Date.now();
}

function handleAnswer(index) {
    const latency = Date.now() - startTime;
    const q = currentQuestions[currentQuestionIndex];
    const isCorrect = index === q.correctAnswerIndex;
    
    cognitiveData.push({ latency, isCorrect });
    
    if (isCorrect) {
        score++;
        soundService.playSound('correct');
    } else {
        soundService.playSound('incorrect');
    }

    if (++currentQuestionIndex < currentQuestions.length) {
        renderQuestion();
    } else {
        finishLevel();
    }
}

async function finishLevel() {
    const passRate = score / currentQuestions.length;
    const passed = passRate >= 0.7;
    
    // XP Calculation: Base 50 + 10 per correct answer + Speed bonus
    const avgLatency = cognitiveData.reduce((acc, d) => acc + d.latency, 0) / cognitiveData.length;
    const speedBonus = avgLatency < 5000 ? 25 : 0;
    const xpGained = (score * 15) + speedBonus + (passed ? 50 : 0);

    if (passed) {
        learningPathService.completeLevel(levelContext.journeyId);
        await firebaseService.broadcastEcho('LEVEL_UP', levelContext.level);
        showToast(`Level Mastered! +${xpGained} XP`, 'success');
    } else {
        showToast(`Level Failed. Analysis required.`, 'error');
    }

    historyService.addQuizAttempt({
        topic: levelContext.topic,
        score,
        totalQuestions: currentQuestions.length,
        xpGained: xpGained
    });

    // Move to Results state
    document.getElementById('level-quiz-state').classList.remove('active');
    document.getElementById('level-results-state').classList.add('active');
    
    document.getElementById('results-title').textContent = passed ? "Synchronized" : "Buffer Error";
    document.getElementById('xp-gain-text').textContent = `+${xpGained} XP Earned`;
    document.getElementById('results-details').textContent = `Precision: ${Math.round(passRate * 100)}% | Response Time: ${Math.round(avgLatency/1000)}s`;
    
    const actionContainer = document.getElementById('results-actions');
    actionContainer.innerHTML = `<button class="btn btn-primary" id="finish-btn">Return to Map</button>`;
    document.getElementById('finish-btn').onclick = () => window.location.hash = '#/topics';
}

export function init() {
    const state = stateService.getState();
    levelContext = state.navigationContext;
    if (!levelContext.topic) return window.location.hash = '#/topics';
    startLevel();
}
