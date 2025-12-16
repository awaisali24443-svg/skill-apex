
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

let levelData = { questions: [] };
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
let autoAdvanceTimer = null; // New timer for auto-navigation

function switchState(targetStateId) {
    // 1. Hide all
    document.querySelectorAll('.game-level-state').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none'; 
    });
    
    // 2. Show target
    const target = document.getElementById(targetStateId);
    if (target) {
        target.style.display = 'flex';
        // Force reflow
        void target.offsetWidth; 
        target.classList.add('active');
    } else {
        console.error(`State ${targetStateId} not found!`);
    }
}

async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    console.log("Starting Level:", topic, level);
    
    if (!topic) {
        showToast("Navigation lost. Returning...", "error");
        setTimeout(() => window.location.hash = '#/topics', 1000);
        return;
    }
    
    switchState('level-loading-state');
    
    const loadingTextEl = document.getElementById('loading-status-text');
    if (loadingTextEl) loadingTextEl.textContent = `Initializing Level ${level}...`;

    // SAFETY NET: Force fallback if API takes > 6 seconds
    loadingTimeout = setTimeout(() => {
        console.warn("Level load timed out. Forcing fallback.");
        useFallbackData("Connection slow. Switching to offline data.");
    }, 6000);
    
    try {
        // 1. Try Cache First
        const cachedLevel = levelCacheService.getLevel(topic, level);
        if (cachedLevel && cachedLevel.questions && cachedLevel.questions.length > 0) {
            console.log("Loaded level from cache");
            clearTimeout(loadingTimeout);
            levelData = cachedLevel;
            processLevelData();
            return;
        }

        // 2. Fetch from API (Parallel)
        // We catch errors individually so one failure doesn't kill the other
        const [lessonData, questionsData] = await Promise.all([
            apiService.generateLevelLesson({ topic, level, totalLevels }).catch(e => null),
            apiService.generateLevelQuestions({ topic, level, totalLevels }).catch(e => null)
        ]);

        clearTimeout(loadingTimeout);

        // 3. Validate Data
        if (!questionsData || !questionsData.questions || questionsData.questions.length === 0) {
            console.warn("API returned invalid question data. Using fallback.");
            useFallbackData();
            return;
        }

        levelData = {
            lesson: lessonData?.lesson || "Briefing unavailable.",
            questions: questionsData.questions
        };
        
        // Cache for next time
        levelCacheService.saveLevel(topic, level, levelData);
        
        processLevelData();
        
        // Preload next level in background
        setTimeout(() => preloadNextLevel(), 5000);

    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Level Start Critical Error:", error);
        useFallbackData();
    }
}

function useFallbackData(msg = "Offline Mode Active") {
    showToast(msg, "info");
    
    // Hardcoded Fallback to ensure UI NEVER stays blank
    levelData = {
        lesson: `### Offline Simulation\n\n**Topic:** ${levelContext.topic || 'Unknown'}\n\nWe are currently operating in offline mode. The neural link to the central core is temporarily unavailable. \n\nProceed with the simulation exercises below to maintain proficiency.`,
        questions: [
            {
                question: `(Offline) What is the key concept of ${levelContext.topic || 'this topic'}?`,
                options: ["Consistency", "Magic", "Luck", "Chaos"],
                correctAnswerIndex: 0,
                explanation: "Consistency is key to mastering any skill."
            },
            {
                question: "Which action helps retention most?",
                options: ["Sleeping", "Active Recall", "Eating", "Watching TV"],
                correctAnswerIndex: 1,
                explanation: "Active Recall forces your brain to retrieve information."
            },
            {
                question: "True or False: Learning is a linear process.",
                options: ["True", "False", "Maybe", "Unknown"],
                correctAnswerIndex: 1,
                explanation: "Learning often involves plateaus and breakthroughs."
            }
        ]
    };
    processLevelData();
}

function processLevelData() {
    if (!levelData.questions || levelData.questions.length === 0) {
        useFallbackData(); // Infinite safety loop breaker
        return;
    }
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
        if(qData?.questions) {
            levelCacheService.saveLevel(levelContext.topic, nextLevel, { lesson: lData?.lesson || "", questions: qData.questions });
        }
    } catch(e) { /* Ignore background errors */ }
}

function renderLesson() {
    if (elements.lessonTitle) elements.lessonTitle.textContent = `Level ${levelContext.level} Briefing`;
    
    const container = elements.lessonBody;
    if (container) {
        container.innerHTML = markdownService.render(levelData.lesson || "Content loading...");
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
    
    // Reset timer state
    if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
    
    if (!currentQuestions || currentQuestions.length === 0) {
        showResults();
        return;
    }

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
        elements.submitAnswerBtn.className = 'btn btn-primary'; // Reset classes
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
    if (answered) return; // Prevent double submit
    if (selectedAnswerIndex === null && timeLeft > 0) return; // Allow submit if time ran out (selectedAnswerIndex might be -1)

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

    // Update UI for Feedback
    if (elements.quizOptionsContainer) {
        elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
            const index = parseInt(btn.dataset.index, 10);
            if (index === question.correctAnswerIndex) btn.classList.add('correct');
            else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
            btn.disabled = true;
        });
    }

    if (elements.hintBtn) elements.hintBtn.disabled = true;
    
    // --- NEW: Button Feedback & Auto Advance ---
    if (elements.submitAnswerBtn) {
        elements.submitAnswerBtn.disabled = true; // Prevent clicks
        
        if (isCorrect) {
            elements.submitAnswerBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#check"/></svg> Correct!`;
            elements.submitAnswerBtn.className = 'btn btn-success'; // Requires CSS
        } else {
            elements.submitAnswerBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#x"/></svg> Incorrect`;
            elements.submitAnswerBtn.className = 'btn btn-danger'; // Requires CSS
        }
    }

    // Set Auto-Advance Timer (1.5 seconds)
    autoAdvanceTimer = setTimeout(() => {
        handleNextQuestion();
    }, 1500);
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

    // Only record if we actually played
    if (total > 0) {
        historyService.addQuizAttempt({
            topic: `${levelContext.topic} - Level ${levelContext.level}`,
            score: score,
            totalQuestions: total,
            startTime: Date.now(),
            endTime: Date.now(),
            xpGained: xpGainedThisLevel,
            fastAnswers: fastAnswersCount
        });
    }

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
    // Pause timer if quitting
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    
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
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer); // Cleanup logic for auto-advance
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
}
