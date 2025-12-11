
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
import * as vfxService from '../../services/vfxService.js'; // Import VFX

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

// Typewriter
let typewriterInterval = null;

function switchState(targetStateId) {
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

/**
 * Starts the level. Fetches Lesson and Questions in PARALLEL.
 * This enables the "Skip" feature because questions might arrive before the user finishes reading.
 */
async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    
    switchState('level-loading-state');
    
    try {
        // Parallel Generation: Request Lesson AND Questions at the same time.
        // For Level 1, this will now hit the Pre-baked JSON and be instant.
        const [lessonData, questionsData] = await Promise.all([
            apiService.generateLevelLesson({ topic, level, totalLevels }),
            apiService.generateLevelQuestions({ topic, level, totalLevels })
        ]);

        levelData = {
            lesson: lessonData.lesson,
            questions: questionsData.questions
        };
        
        currentQuestions = levelData.questions;
        
        // Render Lesson (Default View)
        renderLesson();

        // --- AGGRESSIVE EXPO PREFETCH ---
        // As soon as Level 1 loads successfully, start generating Level 2 in the background.
        preloadNextLevel();

    } catch (error) {
        showToast("Connection Error. Retrying...", "error");
        setTimeout(() => window.history.back(), 2000);
    }
}

async function preloadNextLevel() {
    const nextLevel = levelContext.level + 1;
    if (nextLevel > levelContext.totalLevels) return;
    
    // Don't prefetch if we already have it
    if (levelCacheService.getLevel(levelContext.topic, nextLevel)) return;

    console.log(`[EXPO PREFETCH] Starting background generation for Level ${nextLevel}...`);
    
    try {
        const [lData, qData] = await Promise.all([
            apiService.generateLevelLesson({ topic: levelContext.topic, level: nextLevel, totalLevels: levelContext.totalLevels }),
            apiService.generateLevelQuestions({ topic: levelContext.topic, level: nextLevel, totalLevels: levelContext.totalLevels })
        ]);
        
        const nextLevelData = { lesson: lData.lesson, questions: qData.questions };
        levelCacheService.saveLevel(levelContext.topic, nextLevel, nextLevelData);
        console.log(`[EXPO PREFETCH] Level ${nextLevel} ready in cache.`);
    } catch(e) {
        console.warn("[EXPO PREFETCH] Background gen failed (silent)", e);
    }
}

// --- TYPEWRITER ---
function renderLessonTypewriter(htmlContent) {
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    const container = elements.lessonBody;
    container.innerHTML = htmlContent; // Instant render for speed
}

function renderLesson() {
    elements.lessonTitle.textContent = `Level ${levelContext.level}: Mission Briefing`;
    
    const rawHtml = markdownService.render(levelData.lesson);
    switchState('level-lesson-state');
    renderLessonTypewriter(rawHtml);
}

// --- QUIZ LOGIC ---

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    xpGainedThisLevel = 0;
    
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
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    
    elements.timerText.textContent = `00:${timeLeft}`;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const seconds = String(timeLeft % 60).padStart(2, '0');
        elements.timerText.textContent = `00:${seconds}`;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    soundService.playSound('incorrect');
    vfxService.shake(document.getElementById('question-container')); // VFX Shake
    selectedAnswerIndex = -1; // No selection
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
    
    if (isCorrect) {
        score++;
        const xp = hintUsedThisQuestion ? 5 : 10;
        xpGainedThisLevel += xp;
        soundService.playSound('correct');
        
        // VFX: Confetti on click position
        const selectedBtn = elements.quizOptionsContainer.querySelector('.option-btn.selected');
        if (selectedBtn) {
            const rect = selectedBtn.getBoundingClientRect();
            vfxService.burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
    } else {
        soundService.playSound('incorrect');
        // VFX: Screen Shake
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

function showResults() {
    const total = currentQuestions.length;
    const passed = (score / total) >= 0.7;

    soundService.playSound(passed ? 'finish' : 'incorrect');
    
    if (passed) {
        vfxService.burstConfetti(); // Center burst
    }

    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score,
        totalQuestions: total,
        startTime: Date.now(),
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
    });

    if (passed) {
        elements.resultsTitle.textContent = 'Mission Complete';
        elements.resultsDetails.textContent = `You scored ${score}/${total}. Security clearance updated.`;
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-primary">Continue</a>`;
        
        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey) learningPathService.completeLevel(levelContext.journeyId);

    } else {
        elements.resultsTitle.textContent = 'Mission Failed';
        elements.resultsDetails.textContent = `Score: ${score}/${total}. Review the briefing and try again.`;
        elements.resultsActions.innerHTML = `<button id="retry-level-btn" class="btn btn-primary">Retry Mission</button>`;
        document.getElementById('retry-level-btn').onclick = () => startLevel();
    }
    
    switchState('level-results-state');
    
    // VFX: Animate XP
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

    elements.skipBtn.addEventListener('click', startQuiz);
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.quitBtn.addEventListener('click', handleQuit);
    elements.hintBtn.addEventListener('click', handleHintClick);

    startLevel();
}

export function destroy() {
    clearInterval(timerInterval);
    if (typewriterInterval) clearInterval(typewriterInterval);
}
