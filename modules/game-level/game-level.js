import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as markdownService from '../../services/markdownService.js';
import * as soundService from '../../services/soundService.js';
import * as historyService from '../../services/historyService.js';
import * as levelCacheService from '../../services/levelCacheService.js';

let appState;
let levelData;
let currentQuestionIndex = 0;
let score = 0;
let answered = false;
let elements = {};
const PASS_THRESHOLD = 0.8; // 80% to pass

function switchState(targetStateId) {
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

async function startLevel() {
    const { topic, level, journeyId } = appState.context;
    if (!topic || !level || !journeyId) {
        window.location.hash = '/topics';
        return;
    }
    
    elements.loadingTitle.textContent = `Level ${level}: ${topic}`;
    switchState('level-loading-state');

    // Try cache first
    const cachedLevel = levelCacheService.getLevel(topic, level);
    if (cachedLevel) {
        console.log(`Level ${level} for "${topic}" loaded from cache.`);
        levelData = cachedLevel;
        renderLesson();
        switchState('level-lesson-state');
        return;
    }

    // If not in cache and offline, show error
    if (!navigator.onLine) {
        elements.loadingTitle.textContent = 'You are Offline';
        elements.loadingTitle.nextElementSibling.textContent = 'This level is not cached for offline use. Please connect to the internet to play it for the first time.';
        elements.loadingTitle.parentElement.querySelector('.spinner').style.display = 'none';
        elements.cancelBtn.textContent = 'Back to Map';
        return;
    }
    
    // If online, fetch from API
    try {
        levelData = await apiService.generateLevel({ topic, level });
        if (!levelData || !levelData.lesson || !levelData.questions || levelData.questions.length === 0) {
            throw new Error("AI failed to generate valid level content.");
        }
        // Save to cache on success
        levelCacheService.saveLevel(topic, level, levelData);

        renderLesson();
        switchState('level-lesson-state');
    } catch (error) {
        elements.loadingTitle.textContent = 'Error';
        elements.loadingTitle.nextElementSibling.textContent = error.message;
        elements.loadingTitle.parentElement.querySelector('.spinner').style.display = 'none';
        elements.cancelBtn.textContent = 'Back to Map';
    }
}

function renderLesson() {
    elements.lessonTitle.textContent = `Level ${appState.context.level}: ${appState.context.topic}`;
    elements.lessonBody.innerHTML = markdownService.render(levelData.lesson);
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    renderQuestion();
    switchState('level-quiz-state');
    soundService.playSound('start');
}

function renderQuestion() {
    answered = false;
    const question = levelData.questions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${levelData.questions.length}`;
    const progress = ((currentQuestionIndex + 1) / levelData.questions.length) * 100;
    elements.quizProgressBarFill.style.width = `${progress}%`;
    
    elements.quizQuestionText.textContent = question.question;
    elements.quizOptionsContainer.innerHTML = '';
    question.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.className = 'btn option-btn';
        button.textContent = optionText;
        button.dataset.index = index;
        elements.quizOptionsContainer.appendChild(button);
    });

    elements.quizExplanationContainer.style.display = 'none';
}

function handleOptionClick(event) {
    const button = event.target.closest('.option-btn');
    if (answered || !button) return;
    answered = true;

    const selectedIndex = parseInt(button.dataset.index, 10);
    const question = levelData.questions[currentQuestionIndex];
    const isCorrect = question.correctAnswerIndex === selectedIndex;
    
    if (isCorrect) {
        score++;
        soundService.playSound('correct');
    } else {
        soundService.playSound('incorrect');
    }

    // Update button styles
    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex) {
            btn.classList.add('incorrect');
        }
        btn.disabled = true;
    });

    elements.quizExplanationText.textContent = question.explanation;
    elements.quizExplanationContainer.style.display = 'block';
    elements.nextQuestionBtn.focus();
}

function handleNextQuestion() {
    if (currentQuestionIndex < levelData.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    const totalQuestions = levelData.questions.length;
    const scorePercent = totalQuestions > 0 ? (score / totalQuestions) : 0;
    const passed = scorePercent >= PASS_THRESHOLD;

    soundService.playSound('finish');
    
    // Save attempt to history
    historyService.addQuizAttempt({
        topic: `${appState.context.topic} - Level ${appState.context.level}`,
        score: score,
        totalQuestions: totalQuestions,
        startTime: Date.now() - 10000, // Approximate start time
        endTime: Date.now(),
    });

    if (passed) {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#check-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon passed';
        elements.resultsTitle.textContent = `Level ${appState.context.level} Complete!`;
        elements.resultsDetails.textContent = `You scored ${score} out of ${totalQuestions}. Great job!`;
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(appState.context.topic)}" class="btn btn-primary">Continue Journey</a>`;
        
        // Only advance the journey if the user passed their CURRENT level.
        const currentJourneyState = learningPathService.getJourneyById(appState.context.journeyId);
        if (currentJourneyState && currentJourneyState.currentLevel === appState.context.level) {
            learningPathService.completeLevel(appState.context.journeyId);
        }
    } else {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#x-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon failed';
        elements.resultsTitle.textContent = 'Keep Practicing!';
        elements.resultsDetails.textContent = `You scored ${score} out of ${totalQuestions}. Review the lesson and try again.`;
        elements.resultsActions.innerHTML = `
            <a href="#/game/${encodeURIComponent(appState.context.topic)}" class="btn">Back to Map</a>
            <button id="retry-level-btn" class="btn btn-primary">Try Again</button>
        `;
        document.getElementById('retry-level-btn').addEventListener('click', startQuiz);
    }
    switchState('level-results-state');
}

export function init(globalState) {
    appState = globalState;
    elements = {
        loadingTitle: document.getElementById('loading-title'),
        cancelBtn: document.getElementById('cancel-generation-btn'),
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
        startQuizBtn: document.getElementById('start-quiz-btn'),
        quizProgressText: document.getElementById('quiz-progress-text'),
        quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        quizExplanationContainer: document.getElementById('quiz-explanation-container'),
        quizExplanationText: document.getElementById('quiz-explanation-text'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        resultsIcon: document.getElementById('results-icon'),
        resultsTitle: document.getElementById('results-title'),
        resultsDetails: document.getElementById('results-details'),
        resultsActions: document.getElementById('results-actions'),
    };

    elements.cancelBtn.addEventListener('click', () => window.history.back());
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.nextQuestionBtn.addEventListener('click', handleNextQuestion);

    startLevel();
}

export function destroy() {
    // Listeners are on elements that get removed, so they are auto-cleaned.
}