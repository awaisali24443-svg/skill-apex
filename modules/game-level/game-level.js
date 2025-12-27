
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
        // FAST INTERACTION: Use pointerdown to skip 300ms mobile delay
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); // Prevent ghost clicks
            handleAnswer(i);
        });
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
        // Small delay to let the sound play and button state show
        setTimeout(renderQuestion, 200);
    } else {
        setTimeout(finishLevel, 200);
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
        soundService.playSound('finish');
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
    
    // SPONSOR-READY FEATURE: Share Button to create viral loop
    let shareButtonHtml = '';
    if (navigator.share && passed) {
        shareButtonHtml = `<button class="btn" id="share-victory-btn" style="background:var(--color-surface-hover); color:var(--color-primary); border:1px solid var(--color-primary);">
            <svg class="icon"><use href="assets/icons/feather-sprite.svg#share-2"/></svg> Share
        </button>`;
    }

    actionContainer.innerHTML = `
        <div style="display:flex; gap:10px; width:100%; justify-content:center;">
            ${shareButtonHtml}
            <button class="btn btn-primary" id="finish-btn">Return to Map</button>
        </div>
    `;
    
    document.getElementById('finish-btn').onclick = () => window.location.hash = '#/topics';
    
    const shareBtn = document.getElementById('share-victory-btn');
    if (shareBtn) {
        shareBtn.onclick = async () => {
            try {
                await navigator.share({
                    title: 'Skill Apex Mastery',
                    text: `I just mastered ${levelContext.topic} Level ${levelContext.level} on Skill Apex with ${Math.round(passRate * 100)}% precision! 🚀`,
                    url: 'https://skill-apex.onrender.com'
                });
                showToast('Victory broadcasted!', 'success');
            } catch (err) {
                console.log('Share cancelled');
            }
        };
    }
}

export function init() {
    const state = stateService.getState();
    levelContext = state.navigationContext;
    if (!levelContext.topic) return window.location.hash = '#/topics';
    startLevel();
}
