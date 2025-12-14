
import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as markdownService from '../../services/markdownService.js';
import * as soundService from '../../services/soundService.js';
import * as historyService from '../../services/historyService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';
import * as libraryService from '../../services/libraryService.js';
import { showToast } from '../../services/toastService.js';
import * as vfxService from '../../services/vfxService.js';
import * as firebaseService from '../../services/firebaseService.js';

let levelData = {};
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let answered = false;
let elements = {};
let selectedAnswerIndex = null;
let timerInterval = null;
let timeLeft = 60;
let levelContext = {};
let userAnswers = [];
let hintUsedThisQuestion = false;
let xpGainedThisLevel = 0;

// Speed & Combo Tracking
let questionStartTime = 0;
let fastAnswersCount = 0;
let currentCombo = 0;

let typewriterInterval = null;
let loadingTimeout = null;

function switchState(targetStateId) {
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    
    // VALIDATION: Ensure we have a valid topic. If not (e.g. reload), go back to journeys.
    if (!topic) {
        showToast("Session restored. Redirecting to topics...", "info");
        window.location.hash = '#/topics';
        return;
    }
    
    switchState('level-loading-state');
    
    // SAFETY: If loading takes > 15s, assume error and allow user to escape
    loadingTimeout = setTimeout(() => {
        const loadingText = document.getElementById('loading-status-text');
        if (loadingText) loadingText.textContent = "Taking longer than expected... Retrying connection.";
    }, 8000);
    
    try {
        const [lessonData, questionsData] = await Promise.all([
            apiService.generateLevelLesson({ topic, level, totalLevels }),
            apiService.generateLevelQuestions({ topic, level, totalLevels })
        ]);

        clearTimeout(loadingTimeout);

        levelData = {
            lesson: lessonData.lesson,
            questions: questionsData.questions
        };
        
        currentQuestions = levelData.questions;
        renderLesson();
        preloadNextLevel();

    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Level Start Error:", error);
        showToast("Connection Error. Returning to Map...", "error");
        setTimeout(() => window.history.back(), 2000);
    }
}

async function preloadNextLevel() {
    const nextLevel = levelContext.level + 1;
    if (nextLevel > levelContext.totalLevels) return;
    if (levelCacheService.getLevel(levelContext.topic, nextLevel)) return;

    try {
        const [lData, qData] = await Promise.all([
            apiService.generateLevelLesson({ topic: levelContext.topic, level: nextLevel, totalLevels: levelContext.totalLevels }),
            apiService.generateLevelQuestions({ topic: levelContext.topic, level: nextLevel, totalLevels: levelContext.totalLevels })
        ]);
        
        const nextLevelData = { lesson: lData.lesson, questions: qData.questions };
        levelCacheService.saveLevel(levelContext.topic, nextLevel, nextLevelData);
    } catch(e) {
        console.warn("[EXPO PREFETCH] Background gen failed (silent)", e);
    }
}

function renderLessonTypewriter(htmlContent) {
    if (typewriterInterval) clearInterval(typewriterInterval);
    const container = elements.lessonBody;
    container.innerHTML = htmlContent;
}

function renderLesson() {
    elements.lessonTitle.textContent = `Level ${levelContext.level}: Mission Briefing`;
    const rawHtml = markdownService.render(levelData.lesson);
    switchState('level-lesson-state');
    renderLessonTypewriter(rawHtml);
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    xpGainedThisLevel = 0;
    fastAnswersCount = 0;
    currentCombo = 0;
    updateComboDisplay();
    
    renderQuestion();
    switchState('level-quiz-state');
    soundService.playSound('start');
}

function renderQuestion() {
    answered = false;
    selectedAnswerIndex = null;
    hintUsedThisQuestion = false;
    const question = currentQuestions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    elements.quizProgressBarFill.style.width = `${progress}%`;
    
    elements.quizQuestionText.textContent = question.question;
    elements.quizOptionsContainer.innerHTML = '';
    
    question.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.className = 'btn option-btn';
        const textSpan = document.createElement('span');
        textSpan.textContent = optionText;
        button.appendChild(textSpan);
        button.dataset.index = index;
        elements.quizOptionsContainer.appendChild(button);
    });

    elements.submitAnswerBtn.disabled = true;
    elements.submitAnswerBtn.textContent = 'Submit';
    elements.hintBtn.disabled = false;

    startTimer();
    questionStartTime = Date.now(); // Start clock for "Speed Demon"
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    
    elements.timerText.textContent = `00:${timeLeft}`;
    elements.timerText.classList.remove('panic');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const seconds = String(timeLeft % 60).padStart(2, '0');
        elements.timerText.textContent = `00:${seconds}`;
        
        if (timeLeft <= 10) {
            elements.timerText.classList.add('panic');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    soundService.playSound('incorrect');
    vfxService.shake(document.getElementById('question-container'));
    selectedAnswerIndex = -1;
    currentCombo = 0;
    updateComboDisplay();
    handleSubmitAnswer();
}

function handleOptionClick(event) {
    const button = event.target.closest('.option-btn');
    if (answered || !button) return;
    
    soundService.playSound('click');

    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    selectedAnswerIndex = parseInt(button.dataset.index, 10);
    elements.submitAnswerBtn.disabled = false;
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo-display');
    const comboCountEl = document.getElementById('combo-count');
    
    if (currentCombo > 1) {
        comboEl.classList.remove('hidden');
        comboCountEl.textContent = `x${currentCombo}`;
        // Trigger pulse animation
        comboEl.classList.remove('pulse');
        void comboEl.offsetWidth; // Force reflow
        comboEl.classList.add('pulse');
    } else {
        comboEl.classList.add('hidden');
    }
}

function showFloatingText(element, text) {
    const floatEl = document.createElement('span');
    floatEl.className = 'float-xp';
    floatEl.textContent = text;
    element.appendChild(floatEl);
    
    setTimeout(() => {
        floatEl.remove();
    }, 1000);
}

function handleSubmitAnswer() {
    if (answered) {
        handleNextQuestion();
        return;
    }
    clearInterval(timerInterval);
    answered = true;
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = question.correctAnswerIndex === selectedAnswerIndex;
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    
    if (isCorrect) {
        score++;
        currentCombo++;
        
        // Base XP
        let xp = hintUsedThisQuestion ? 5 : 10;
        
        // Speed Bonus
        if (timeTaken < 5) {
            fastAnswersCount++;
            xp += 5; // Bonus XP
        }
        
        // Combo Bonus
        if (currentCombo > 1) {
            xp += (currentCombo * 2);
        }
        
        xpGainedThisLevel += xp;
        soundService.playSound('correct');
        updateComboDisplay();
        
        const selectedBtn = elements.quizOptionsContainer.querySelector('.option-btn.selected');
        if (selectedBtn) {
            const rect = selectedBtn.getBoundingClientRect();
            // Confetti on button
            vfxService.burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
            // Floating Text
            showFloatingText(selectedBtn, `+${xp} XP`);
        }
    } else {
        currentCombo = 0;
        updateComboDisplay();
        soundService.playSound('incorrect');
        vfxService.shake(document.getElementById('question-container'));
    }

    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    elements.hintBtn.disabled = true;
    elements.submitAnswerBtn.textContent = currentQuestionIndex < currentQuestions.length - 1 ? 'Next' : 'Results';
    elements.submitAnswerBtn.disabled = false;
}

function handleNextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

// --- WINNING FEATURE: DIGITAL CERTIFICATE ---
function generateCertificateHTML(name, topic, level) {
    const date = new Date().toLocaleDateString();
    return `
        <div class="certificate-container">
            <div class="cert-border">
                <div class="cert-content">
                    <div class="cert-header">CERTIFICATE OF COMPETENCY</div>
                    <div class="cert-body">
                        <p>This certifies that</p>
                        <h2 class="cert-name">${name}</h2>
                        <p>has successfully cleared</p>
                        <h3 class="cert-topic">${topic}</h3>
                        <p class="cert-level">Level ${level} Assessment</p>
                    </div>
                    <div class="cert-footer">
                        <div class="cert-date">${date}</div>
                        <div class="cert-sig">
                            Awais Ali<br>
                            <span style="font-size:0.6em; letter-spacing:1px; opacity:0.8;">SYSTEM ARCHITECT</span>
                        </div>
                    </div>
                    <div class="cert-seal">
                        <svg class="icon"><use href="assets/icons/feather-sprite.svg#award"/></svg>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showResults() {
    const total = currentQuestions.length;
    const passed = (score / total) >= 0.7;

    soundService.playSound(passed ? 'finish' : 'incorrect');
    
    if (passed) {
        vfxService.burstConfetti(); // Big Burst center screen
    }

    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score,
        totalQuestions: total,
        startTime: Date.now(), // Rough approx
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
        fastAnswers: fastAnswersCount
    });

    if (passed) {
        const userName = firebaseService.getUserName() || "Guest Agent";
        const certHTML = generateCertificateHTML(userName, levelContext.topic, levelContext.level);
        
        elements.resultsTitle.textContent = 'Mission Complete';
        elements.resultsDetails.innerHTML = `
            Score: ${score}/${total}.<br>
            <div class="cert-wrapper">${certHTML}</div>
        `;
        
        elements.resultsActions.innerHTML = `
            <a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-primary" style="width:100%">Continue Journey</a>
        `;
        
        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey) learningPathService.completeLevel(levelContext.journeyId);

    } else {
        elements.resultsTitle.textContent = 'Mission Failed';
        elements.resultsDetails.textContent = `Score: ${score}/${total}. Review the briefing and try again.`;
        elements.resultsActions.innerHTML = `<button id="retry-level-btn" class="btn btn-primary">Retry Mission</button>`;
        document.getElementById('retry-level-btn').onclick = () => startLevel();
    }
    
    switchState('level-results-state');
    
    if (xpGainedThisLevel > 0) {
        vfxService.animateNumber(elements.xpGainText, 0, xpGainedThisLevel);
    } else {
        elements.xpGainText.textContent = '';
    }
}

async function handleQuit() {
    const confirmed = await showConfirmationModal({
        title: 'Abort Mission?',
        message: 'Progress will be lost.',
        confirmText: 'Abort',
        cancelText: 'Stay',
        danger: true,
    });
    if (confirmed) {
        window.location.hash = `#/game/${encodeURIComponent(levelContext.topic)}`;
    }
}

async function handleHintClick() {
    if (elements.hintBtn.disabled) return;
    elements.hintBtn.disabled = true;
    
    try {
        const question = currentQuestions[currentQuestionIndex];
        const data = await apiService.generateHint({ topic: levelContext.topic, question: question.question, options: question.options });
        showToast(data.hint, 'info', 4000);
        hintUsedThisQuestion = true;
    } catch (e) {
        showToast("Hint unavailable.", "error");
    }
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
        startQuizBtn: document.getElementById('start-quiz-btn'),
        skipBtn: document.getElementById('skip-to-quiz-btn'), 
        cancelBtn: document.getElementById('cancel-generation-btn'),
        
        quizProgressText: document.getElementById('quiz-progress-text'),
        quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        submitAnswerBtn: document.getElementById('submit-answer-btn'),
        timerText: document.getElementById('timer-text'),
        
        hintBtn: document.getElementById('hint-btn'),
        quitBtn: document.getElementById('quit-btn'),
        
        resultsTitle: document.getElementById('results-title'),
        resultsDetails: document.getElementById('results-details'),
        resultsActions: document.getElementById('results-actions'),
        xpGainText: document.getElementById('xp-gain-text')
    };

    if(elements.skipBtn) elements.skipBtn.addEventListener('click', startQuiz);
    if(elements.cancelBtn) elements.cancelBtn.addEventListener('click', () => {
        clearTimeout(loadingTimeout);
        window.history.back();
    });
    
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.quitBtn.addEventListener('click', handleQuit);
    elements.hintBtn.addEventListener('click', handleHintClick);

    startLevel();
}

export function destroy() {
    clearInterval(timerInterval);
    clearTimeout(loadingTimeout);
    if (typewriterInterval) clearInterval(typewriterInterval);
}
