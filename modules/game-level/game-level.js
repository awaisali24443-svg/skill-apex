

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

let levelData = {};
let masterQuestionsList = [];
let currentAttemptSet = 0;
let currentQuestions = [];

let isInteractiveLevel = false;
let interactiveData = null;
let interactiveUserState = [];

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
let outputAudioContext = null;
let currentAudioSource = null;
let retryGenerationPromise = null;

// Boss Battle State
let bossHp = 100;
let damagePerHit = 10;
let antiCheatHandler = null;
let focusStrikes = 0;
let focusTimeout = null;

// Async Flow Control
let lessonAbortController = null;
let skippedLesson = false;
let loadingTextInterval = null;
let loadingProgress = 0; // NEW: Progress Tracker

// Drag and Drop State
let dragStartIndex = null;

const PASS_THRESHOLD = 0.8;
const LEVELS_PER_CHAPTER = 50;
const STANDARD_QUESTIONS_PER_ATTEMPT = 3;
const BOSS_TIME_LIMIT = 39;

const LOADING_MESSAGES = [
    "Analyzing Neural Pathways...",
    "Synthesizing Curriculum...",
    "Calibrating Difficulty Vectors...",
    "Generating Scenario Logic...",
    "Compiling Knowledge Shards...",
    "Optimizing Experience..."
];

function announce(message, polite = false) {
    const region = polite ? elements.timerAnnouncer : elements.announcer;
    if (region) region.textContent = message;
}

function switchState(targetStateId) {
    if (targetStateId !== 'level-lesson-state' && currentAudioSource) {
        stopAudio();
    }
    if (targetStateId !== 'level-loading-state') {
        stopLoadingAnimation();
    }
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

// --- Loading Animation with Progress Bar ---
function startLoadingAnimation() {
    if (loadingTextInterval) clearInterval(loadingTextInterval);
    
    let msgIndex = 0;
    loadingProgress = 0;
    
    if(elements.loadingText) elements.loadingText.textContent = "Establishing Link...";
    if(elements.loadingBar) elements.loadingBar.style.width = '0%';

    loadingTextInterval = setInterval(() => {
        // Message Cycle
        if (loadingProgress % 20 === 0) { // Change message every 20 ticks
            if (elements.loadingText) {
                elements.loadingText.textContent = LOADING_MESSAGES[msgIndex];
                msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
            }
        }
        
        // Simulated Progress (Slows down as it gets higher)
        const increment = Math.max(0.5, (90 - loadingProgress) / 20);
        loadingProgress = Math.min(95, loadingProgress + increment);
        
        if(elements.loadingBar) elements.loadingBar.style.width = `${loadingProgress}%`;

    }, 100);
}

function stopLoadingAnimation() {
    if (loadingTextInterval) {
        clearInterval(loadingTextInterval);
        loadingTextInterval = null;
    }
    if(elements.loadingBar) elements.loadingBar.style.width = '100%';
}

async function startLevel(forceRefresh = false) {
    const { topic, level, journeyId, isBoss, totalLevels } = levelContext;
    
    // Reset
    retryGenerationPromise = null;
    if (lessonAbortController) lessonAbortController.abort();
    lessonAbortController = null;
    skippedLesson = false;
    currentAttemptSet = 0;
    masterQuestionsList = [];
    levelData = {};
    isInteractiveLevel = false;
    interactiveData = null;
    removeAntiCheat();

    if (!topic || !level || !journeyId) {
        window.location.hash = '/topics';
        return;
    }

    if (level % 5 === 0 && !isBoss) isInteractiveLevel = true;
    
    switchState('level-loading-state');
    startLoadingAnimation();
    if (elements.skipPopup) elements.skipPopup.style.display = 'none';

    let partialCacheHit = false;

    if (!forceRefresh) {
        const cachedLevel = levelCacheService.getLevel(topic, level);
        if (cachedLevel) {
            if (isInteractiveLevel && cachedLevel.challengeType) {
                levelData = cachedLevel;
                interactiveData = cachedLevel;
                stopLoadingAnimation();
                if (cachedLevel.lesson) renderLesson();
                else startQuiz();
                return;
            } else if (!isInteractiveLevel && cachedLevel.questions) {
                levelData = cachedLevel;
                masterQuestionsList = cachedLevel.questions;
                if (isBoss || cachedLevel.lesson) {
                    stopLoadingAnimation();
                    isBoss ? startQuiz() : renderLesson();
                    return;
                }
                partialCacheHit = true;
            }
        }
    }

    try {
        if (isBoss) {
            const chapter = Math.ceil(level / LEVELS_PER_CHAPTER);
            levelData = await apiService.generateBossBattle({ topic, chapter });
            masterQuestionsList = levelData.questions;
            levelCacheService.saveLevel(topic, level, levelData);
            startQuiz();
        
        } else {
            lessonAbortController = new AbortController();
            const promises = [];

            // Questions (Interactive or Standard)
            if (isInteractiveLevel) {
                if (!partialCacheHit) {
                    promises.push(apiService.generateInteractiveLevel({ topic, level }).then(data => {
                        interactiveData = data;
                        levelData = { ...interactiveData };
                        levelCacheService.saveLevel(topic, level, levelData);
                        if (elements.skipPopup) elements.skipPopup.style.display = 'block';
                    }));
                }
            } else {
                if (!partialCacheHit) {
                    promises.push(apiService.generateLevelQuestions({ topic, level, totalLevels }).then(qData => {
                        masterQuestionsList = qData.questions;
                        levelData.questions = masterQuestionsList;
                        levelCacheService.saveLevel(topic, level, levelData);
                        if (elements.skipPopup) elements.skipPopup.style.display = 'block';
                    }));
                } else {
                    if (elements.skipPopup) elements.skipPopup.style.display = 'block';
                }
            }

            // Lesson
            promises.push(apiService.generateLevelLesson({ 
                topic, level, totalLevels, questions: null, signal: lessonAbortController.signal 
            }).then(lData => {
                levelData.lesson = lData.lesson;
                levelCacheService.saveLevel(topic, level, levelData);
            }).catch(e => {}));

            await Promise.allSettled(promises);
            
            if (!skippedLesson) {
                if (levelData.lesson) renderLesson();
                else startQuiz();
            }
        }
    } catch (error) {
        showToast(error.message, "error");
        window.history.back();
    }
}

function renderLesson() {
    if (!levelData.lesson) return;
    elements.lessonTitle.textContent = `Level ${levelContext.level}: ${levelContext.topic}`;
    elements.lessonBody.innerHTML = markdownService.render(levelData.lesson);
    if(elements.readAloudBtn) elements.readAloudBtn.disabled = false;
    switchState('level-lesson-state');
    
    if (window.mermaid) {
        setTimeout(() => { try { mermaid.init(undefined, document.querySelectorAll('.mermaid')); } catch(e){} }, 100);
    }
}

function startQuiz() {
    skippedLesson = true;
    if (lessonAbortController) lessonAbortController.abort();
    
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    xpGainedThisLevel = 0;
    
    elements.bossHealthContainer.style.display = 'none';

    if (isInteractiveLevel) {
        elements.questionContainer.style.display = 'none';
        elements.interactiveContainer.style.display = 'block';
        elements.interactiveInstruction.textContent = interactiveData.instruction;
        renderInteractiveChallenge();
        elements.submitAnswerBtn.textContent = 'Verify Solution';
        elements.submitAnswerBtn.disabled = false;
        elements.hintBtn.disabled = true;
        switchState('level-quiz-state');
        startTimer();
        return;
    }

    elements.interactiveContainer.style.display = 'none';
    elements.questionContainer.style.display = 'block';

    if (levelContext.isBoss) {
        currentQuestions = masterQuestionsList;
        bossHp = 100;
        damagePerHit = 100 / currentQuestions.length;
        elements.bossHealthContainer.style.display = 'flex';
        activateAntiCheat();
    } else {
        const startIndex = currentAttemptSet * STANDARD_QUESTIONS_PER_ATTEMPT;
        const endIndex = startIndex + STANDARD_QUESTIONS_PER_ATTEMPT;
        if (startIndex >= masterQuestionsList.length) {
            startLevel(true);
            return;
        }
        currentQuestions = masterQuestionsList.slice(startIndex, endIndex);
    }

    renderQuestion();
    switchState('level-quiz-state');
}

// --- Render Interactive (Sort/Match) ---
function renderInteractiveChallenge() {
    const container = document.getElementById('interactive-playground');
    container.innerHTML = '';
    
    if (interactiveData.challengeType === 'sequence') {
        if (interactiveUserState.length === 0) interactiveUserState = [...interactiveData.items].sort(() => Math.random() - 0.5);
        
        interactiveUserState.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'sortable-item';
            el.innerHTML = `<div class="sort-index">${index + 1}</div><span>${item.text}</span>`;
            el.addEventListener('click', () => handleSequenceClick(index));
            container.appendChild(el);
        });
    } else {
        // Match implementation simplified for brevity
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<p>Match mode active</p>';
        container.appendChild(wrapper);
    }
}

// Simple click-to-swap for sequence
let selectedSeqIndex = null;
function handleSequenceClick(index) {
    if (answered) return;
    if (selectedSeqIndex === null) {
        selectedSeqIndex = index;
        document.querySelectorAll('.sortable-item')[index].classList.add('selected');
    } else {
        const temp = interactiveUserState[selectedSeqIndex];
        interactiveUserState[selectedSeqIndex] = interactiveUserState[index];
        interactiveUserState[index] = temp;
        selectedSeqIndex = null;
        renderInteractiveChallenge();
    }
}

function renderQuestion() {
    answered = false;
    selectedAnswerIndex = null;
    const question = currentQuestions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    elements.quizProgressBarFill.style.width = `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%`;
    
    elements.quizQuestionText.textContent = question.question;
    elements.quizOptionsContainer.innerHTML = '';
    
    question.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn option-btn';
        btn.textContent = opt;
        btn.dataset.index = index;
        elements.quizOptionsContainer.appendChild(btn);
    });

    elements.submitAnswerBtn.disabled = true;
    elements.submitAnswerBtn.textContent = 'Submit';
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = (levelContext.isBoss && !isInteractiveLevel) ? BOSS_TIME_LIMIT : 60;
    
    const updateTime = () => {
        elements.timerText.textContent = `00:${String(timeLeft).padStart(2, '0')}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
        timeLeft--;
    };
    updateTime();
    timerInterval = setInterval(updateTime, 1000);
}

function handleTimeUp() {
    soundService.playSound('incorrect');
    handleSubmitAnswer();
}

function handleSubmitAnswer() {
    if (isInteractiveLevel) {
        // Verify sequence
        const correct = JSON.stringify(interactiveUserState.map(i=>i.id)) === JSON.stringify(interactiveData.items.map(i=>i.id));
        score = correct ? 1 : 0;
        showResults(true);
        return;
    }

    if (answered) {
        handleNextQuestion();
        return;
    }
    clearInterval(timerInterval);
    answered = true;
    
    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;
    
    if (isCorrect) {
        score++;
        soundService.playSound('correct');
        if (levelContext.isBoss) {
            bossHp = Math.max(0, bossHp - damagePerHit);
            elements.bossHealthFill.style.width = `${bossHp}%`;
        }
    } else {
        soundService.playSound('incorrect');
    }

    // Highlight answers
    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        if (idx === question.correctAnswerIndex) btn.classList.add('correct');
        else if (idx === selectedAnswerIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

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

function showResults(isInteractive = false) {
    const total = isInteractive ? 1 : currentQuestions.length;
    const passed = (score / total) >= PASS_THRESHOLD;
    
    elements.resultsTitle.textContent = passed ? 'Level Complete!' : 'Keep Trying';
    elements.resultsDetails.textContent = `Score: ${Math.round((score/total)*100)}%`;
    
    const nextBtnText = passed ? 'Next Level' : 'Retry';
    const nextAction = passed ? `#/game/${encodeURIComponent(levelContext.topic)}` : null;
    
    elements.resultsActions.innerHTML = `
        <a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-secondary">Back</a>
        ${passed ? `<a href="${nextAction}" class="btn btn-primary">Continue</a>` : `<button id="retry-btn" class="btn btn-primary">Retry</button>`}
    `;
    
    if (!passed) document.getElementById('retry-btn').onclick = () => handleRetryClick();
    
    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score, totalQuestions: total,
        startTime: Date.now(), endTime: Date.now(), xpGained: passed ? 50 : 10
    });

    switchState('level-results-state');
}

function handleRetryClick() {
    if (!levelContext.isBoss && !isInteractiveLevel && ((currentAttemptSet + 1) * STANDARD_QUESTIONS_PER_ATTEMPT < masterQuestionsList.length)) {
        currentAttemptSet++;
        startQuiz();
    } else {
        startLevel(true);
    }
}

// --- Anti-Cheat Stubs ---
function activateAntiCheat() {}
function removeAntiCheat() {}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
        loadingText: document.getElementById('loading-status-text'),
        loadingBar: document.getElementById('loading-progress-bar'),
        skipPopup: document.getElementById('skip-lesson-popup'),
        skipBtn: document.getElementById('skip-to-quiz-btn'),
        cancelBtn: document.getElementById('cancel-generation-btn'),
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
        startQuizBtn: document.getElementById('start-quiz-btn'),
        readAloudBtn: document.getElementById('read-aloud-btn'),
        askAiBtn: document.getElementById('ask-ai-btn'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        submitAnswerBtn: document.getElementById('submit-answer-btn'),
        hintBtn: document.getElementById('hint-btn'),
        timerText: document.getElementById('timer-text'),
        quizProgressText: document.getElementById('quiz-progress-text'),
        quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
        resultsTitle: document.getElementById('results-title'),
        resultsDetails: document.getElementById('results-details'),
        resultsActions: document.getElementById('results-actions'),
        questionContainer: document.getElementById('question-container'),
        interactiveContainer: document.getElementById('interactive-container'),
        interactiveInstruction: document.getElementById('interactive-instruction'),
        bossHealthContainer: document.getElementById('boss-health-container'),
        bossHealthFill: document.getElementById('boss-health-fill'),
    };

    elements.cancelBtn.onclick = () => window.history.back();
    elements.skipBtn.onclick = startQuiz;
    elements.startQuizBtn.onclick = startQuiz;
    elements.submitAnswerBtn.onclick = handleSubmitAnswer;
    elements.quizOptionsContainer.onclick = (e) => {
        const btn = e.target.closest('.option-btn');
        if(btn && !answered) {
            elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAnswerIndex = parseInt(btn.dataset.index);
            elements.submitAnswerBtn.disabled = false;
        }
    };

    startLevel(false);
}

export function destroy() {
    clearInterval(timerInterval);
    stopLoadingAnimation();
    if (lessonAbortController) lessonAbortController.abort();
}
