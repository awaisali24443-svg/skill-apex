
import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as markdownService from '../../services/markdownService.js';
import * as soundService from '../../services/soundService.js';
import * as historyService from '../../services/historyService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';
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

let loadingTimeout = null;
let keydownHandler = null;

function switchState(targetStateId) {
    // 1. Hide all
    document.querySelectorAll('.game-level-state').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; // Force hide
    });
    
    // 2. Show target
    const target = document.getElementById(targetStateId);
    if (target) {
        target.style.display = 'flex'; // Force flex
        // Small delay to allow display:flex to apply before adding active class for opacity transition
        requestAnimationFrame(() => {
            target.classList.add('active');
        });
    } else {
        console.error(`State ${targetStateId} not found!`);
    }
}

async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    
    if (!topic) {
        showToast("Navigation lost. Returning to base...", "error");
        setTimeout(() => window.location.hash = '#/topics', 1000);
        return;
    }
    
    switchState('level-loading-state');
    
    const loadingTextEl = document.getElementById('loading-status-text');
    if (loadingTextEl) loadingTextEl.textContent = `Initializing Level ${level}...`;

    // SAFETY NET: If API hangs, force fallback after 8 seconds
    loadingTimeout = setTimeout(() => {
        if (document.getElementById('level-loading-state').style.display !== 'none') {
            console.warn("Level load timed out. Using emergency protocol.");
            showToast("Connection slow. Switching to offline data.", "info");
            useFallbackData();
        }
    }, 8000);
    
    try {
        // 1. Try Cache First
        const cachedLevel = levelCacheService.getLevel(topic, level);
        if (cachedLevel) {
            console.log("Loaded level from cache");
            clearTimeout(loadingTimeout);
            levelData = cachedLevel;
            processLevelData();
            return;
        }

        // 2. Fetch from API (Parallel)
        const [lessonData, questionsData] = await Promise.all([
            apiService.generateLevelLesson({ topic, level, totalLevels }),
            apiService.generateLevelQuestions({ topic, level, totalLevels })
        ]);

        clearTimeout(loadingTimeout);

        // 3. Validate Data
        if (!lessonData?.lesson || !questionsData?.questions || questionsData.questions.length === 0) {
            throw new Error("Invalid data received from Core.");
        }

        levelData = {
            lesson: lessonData.lesson,
            questions: questionsData.questions
        };
        
        // Cache for next time
        levelCacheService.saveLevel(topic, level, levelData);
        
        processLevelData();
        
        // Preload next level in background
        setTimeout(() => preloadNextLevel(), 5000);

    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Level Start Error:", error);
        useFallbackData();
    }
}

function useFallbackData() {
    // Manually construct fallback if API failed
    levelData = {
        lesson: `### Offline Mode Active\n\nWe couldn't reach the neural core for **${levelContext.topic}**. \n\nDon't worry, you can still train. Focus on the basics and answer the questions to the best of your ability. Connectivity will be restored shortly.`,
        questions: [
            {
                question: "What is the primary goal of this topic?",
                options: ["Confusion", "Mastery", "Sleep", "Nothing"],
                correctAnswerIndex: 1,
                explanation: "The goal of any learning journey is mastery of the subject."
            },
            {
                question: "If you encounter a bug, what should you do?",
                options: ["Panic", "Debug it", "Ignore it", "Delete system32"],
                correctAnswerIndex: 1,
                explanation: "Debugging is the process of finding and resolving defects."
            },
            {
                question: "True or False: Consistency is key.",
                options: ["True", "False", "Maybe", "Depends"],
                correctAnswerIndex: 0,
                explanation: "Regular practice is the most effective way to learn."
            }
        ]
    };
    processLevelData();
}

function processLevelData() {
    currentQuestions = levelData.questions;
    renderLesson();
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
        if(lData?.lesson && qData?.questions) {
            levelCacheService.saveLevel(levelContext.topic, nextLevel, { lesson: lData.lesson, questions: qData.questions });
        }
    } catch(e) { /* Ignore background errors */ }
}

function renderLesson() {
    if (elements.lessonTitle) elements.lessonTitle.textContent = `Level ${levelContext.level} Briefing`;
    
    const container = elements.lessonBody;
    if (container) {
        container.innerHTML = markdownService.render(levelData.lesson || "Content unavailable.");
        container.scrollTop = 0;
    }
    
    switchState('level-lesson-state');
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
    
    if (elements.quizProgressText) elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    if (elements.quizProgressBarFill) elements.quizProgressBarFill.style.width = `${progress}%`;
    
    if (elements.quizQuestionText) elements.quizQuestionText.textContent = question.question;
    
    if (elements.quizOptionsContainer) {
        elements.quizOptionsContainer.innerHTML = '';
        question.options.forEach((optionText, index) => {
            const button = document.createElement('button');
            button.className = 'btn option-btn';
            
            // Number hint
            const keyHint = document.createElement('span');
            keyHint.className = 'key-hint';
            keyHint.textContent = index + 1;
            keyHint.style.cssText = 'margin-right: 10px; font-weight: bold; opacity: 0.5; border: 1px solid var(--color-border); border-radius: 4px; padding: 2px 6px; font-size: 0.8rem;';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = optionText;
            
            button.appendChild(keyHint);
            button.appendChild(textSpan);
            button.dataset.index = index;
            elements.quizOptionsContainer.appendChild(button);
        });
    }

    if (elements.submitAnswerBtn) {
        elements.submitAnswerBtn.disabled = true;
        elements.submitAnswerBtn.textContent = 'Submit';
    }
    if (elements.hintBtn) elements.hintBtn.disabled = false;

    startTimer();
    questionStartTime = Date.now();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    
    if(elements.timerText) {
        elements.timerText.textContent = `00:${timeLeft}`;
        elements.timerText.classList.remove('panic');
    }
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const seconds = String(timeLeft % 60).padStart(2, '0');
        if (elements.timerText) elements.timerText.textContent = `00:${seconds}`;
        
        if (timeLeft <= 10 && elements.timerText) {
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
    selectOption(parseInt(button.dataset.index, 10));
}

function selectOption(index) {
    if (answered) return;
    soundService.playSound('click');
    
    if (elements.quizOptionsContainer) {
        elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
        const targetBtn = elements.quizOptionsContainer.querySelector(`.option-btn[data-index="${index}"]`);
        if(targetBtn) targetBtn.classList.add('selected');
    }
    
    selectedAnswerIndex = index;
    if (elements.submitAnswerBtn) elements.submitAnswerBtn.disabled = false;
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo-display');
    const comboCountEl = document.getElementById('combo-count');
    
    if (!comboEl || !comboCountEl) return;

    if (currentCombo > 1) {
        comboEl.classList.remove('hidden');
        comboCountEl.textContent = `x${currentCombo}`;
        comboEl.classList.remove('pulse');
        void comboEl.offsetWidth; 
        comboEl.classList.add('pulse');
    } else {
        comboEl.classList.add('hidden');
    }
}

function handleSubmitAnswer() {
    if (answered) {
        handleNextQuestion();
        return;
    }
    
    if (selectedAnswerIndex === null) return;

    clearInterval(timerInterval);
    answered = true;
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = question.correctAnswerIndex === selectedAnswerIndex;
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    
    if (isCorrect) {
        score++;
        currentCombo++;
        let xp = hintUsedThisQuestion ? 5 : 10;
        
        if (timeTaken < 5) {
            fastAnswersCount++;
            xp += 5; 
        }
        
        if (currentCombo > 1) {
            xp += (currentCombo * 2);
        }
        
        xpGainedThisLevel += xp;
        soundService.playSound('correct', currentCombo);
        updateComboDisplay();
        
        const selectedBtn = elements.quizOptionsContainer.querySelector('.option-btn.selected');
        if (selectedBtn) {
            const rect = selectedBtn.getBoundingClientRect();
            vfxService.burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
    } else {
        currentCombo = 0;
        updateComboDisplay();
        soundService.playSound('incorrect');
        vfxService.shake(document.getElementById('question-container'));
    }

    if (elements.quizOptionsContainer) {
        elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
            const index = parseInt(btn.dataset.index, 10);
            if (index === question.correctAnswerIndex) btn.classList.add('correct');
            else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
            btn.disabled = true;
        });
    }

    if (elements.hintBtn) elements.hintBtn.disabled = true;
    if (elements.submitAnswerBtn) {
        elements.submitAnswerBtn.textContent = currentQuestionIndex < currentQuestions.length - 1 ? 'Next' : 'Results';
        elements.submitAnswerBtn.disabled = false;
        elements.submitAnswerBtn.focus();
    }
}

function handleNextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    const total = currentQuestions.length;
    const passed = (score / total) >= 0.7;

    soundService.playSound(passed ? 'finish' : 'incorrect');
    if (passed) vfxService.burstConfetti();

    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score,
        totalQuestions: total,
        startTime: Date.now(),
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
        fastAnswers: fastAnswersCount
    });

    if (passed) {
        if (elements.resultsTitle) elements.resultsTitle.textContent = 'Mission Complete';
        if (elements.resultsDetails) elements.resultsDetails.textContent = `Score: ${score}/${total}. Well done.`;
        if (elements.resultsActions) {
            elements.resultsActions.innerHTML = `
                <a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-primary" style="width:100%">Continue Journey</a>
            `;
        }
        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey) learningPathService.completeLevel(levelContext.journeyId);
    } else {
        if (elements.resultsTitle) elements.resultsTitle.textContent = 'Mission Failed';
        if (elements.resultsDetails) elements.resultsDetails.textContent = `Score: ${score}/${total}. Review required.`;
        if (elements.resultsActions) {
            elements.resultsActions.innerHTML = `<button id="retry-level-btn" class="btn btn-primary">Retry Mission</button>`;
            document.getElementById('retry-level-btn').onclick = () => startLevel();
        }
    }
    
    switchState('level-results-state');
    
    if (elements.xpGainText) {
        elements.xpGainText.textContent = xpGainedThisLevel > 0 ? `+${xpGainedThisLevel} XP` : '';
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

function handleKeyDown(e) {
    if (!document.getElementById('level-quiz-state')?.classList.contains('active')) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitAnswer();
    } else if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        selectOption(index);
    }
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext || {};

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
    
    if(elements.startQuizBtn) elements.startQuizBtn.addEventListener('click', startQuiz);
    if(elements.submitAnswerBtn) elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    if(elements.quizOptionsContainer) elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    if(elements.quitBtn) elements.quitBtn.addEventListener('click', handleQuit);
    if(elements.hintBtn) elements.hintBtn.addEventListener('click', handleHintClick);

    keydownHandler = handleKeyDown;
    document.addEventListener('keydown', keydownHandler);

    // Initial state set
    switchState('level-loading-state');
    
    // Defer start slightly to allow UI paint
    setTimeout(startLevel, 50);
}

export function destroy() {
    clearInterval(timerInterval);
    clearTimeout(loadingTimeout);
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
}
