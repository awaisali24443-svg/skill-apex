
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
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    
    if (!topic) {
        showToast("No topic selected. Redirecting...", "info");
        window.location.hash = '#/';
        return;
    }
    
    switchState('level-loading-state');
    
    const loadingTextEl = document.getElementById('loading-status-text');
    if (loadingTextEl) loadingTextEl.textContent = `Generating Quiz for "${topic}"...`;

    loadingTimeout = setTimeout(() => {
        if (loadingTextEl && document.getElementById('level-loading-state').classList.contains('active')) {
            loadingTextEl.textContent = "Finalizing questions...";
        }
    }, 4000);
    
    try {
        // Parallel Fetching
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

    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Level Start Error:", error);
        showToast("Generation Failed. Please try again.", "error");
        setTimeout(() => window.history.back(), 2000);
    }
}

function renderLesson() {
    elements.lessonTitle.textContent = `Topic Briefing`;
    const rawHtml = markdownService.render(levelData.lesson);
    switchState('level-lesson-state');
    elements.lessonBody.innerHTML = rawHtml;
    elements.lessonBody.scrollTop = 0;
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
    