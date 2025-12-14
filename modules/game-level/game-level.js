
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

function switchState(targetStateId) {
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

async function startLevel() {
    const { topic, level, totalLevels } = levelContext;
    
    if (!topic) {
        showToast("Session restored. Redirecting...", "info");
        window.location.hash = '#/topics';
        return;
    }
    
    switchState('level-loading-state');
    
    // Safety Timeout: If AI is slow (>8s), allow fallback
    loadingTimeout = setTimeout(() => {
        const loadingText = document.getElementById('loading-status-text');
        if (loadingText) {
            loadingText.innerHTML = "Generating Quiz Questions...<br><span style='font-size:0.8rem; opacity:0.7'>Network is busy.</span>";
            // Auto-engage fallback after 12s total
            setTimeout(() => engageEmergencyProtocol(topic), 4000);
        }
    }, 8000);
    
    try {
        // 1. Check Cache
        const cachedData = levelCacheService.getLevel(topic, level);
        if (cachedData) {
            console.log("Loaded level from cache");
            processLevelData(cachedData);
            return;
        }

        // 2. Fetch Questions (Priority) & Briefing (Background)
        // We prioritize questions for the quiz system
        const qPromise = apiService.generateLevelQuestions({ topic, level, totalLevels });
        const lPromise = apiService.generateLevelLesson({ topic, level, totalLevels });

        const questionsResult = await qPromise;
        clearTimeout(loadingTimeout); // Got questions, we are good

        // Handle Questions
        if (questionsResult && Array.isArray(questionsResult.questions) && questionsResult.questions.length > 0) {
            const newData = { questions: questionsResult.questions };
            
            // Try to get lesson, but don't block if it fails
            lPromise.then(lResult => {
                newData.lesson = lResult?.lesson || "Briefing unavailable.";
                levelCacheService.saveLevel(topic, level, newData);
                // If we are still in loading screen, update data
                levelData = newData;
            }).catch(() => {
                newData.lesson = "Briefing unavailable.";
                levelCacheService.saveLevel(topic, level, newData);
            });

            processLevelData(newData);
            
            // Background prefetch next level
            preloadNextLevel();
        } else {
            throw new Error("Invalid question format");
        }

    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error("Level Start Error:", error);
        engageEmergencyProtocol(topic);
    }
}

function engageEmergencyProtocol(topic) {
    showToast("Using Offline Quiz Protocol", "info");
    
    const emergencyData = {
        lesson: `### Offline Mode\n\nUnable to reach AI Core. Running local backup quiz for **${topic}**.`,
        questions: [
            {
                question: `(Offline) What is a core principle of ${topic}?`,
                options: ["Randomness", "Structure & Consistency", "Chaos", "Inertia"],
                correctAnswerIndex: 1,
                explanation: "Consistency is key to mastering any subject."
            },
            {
                question: "Which of these is most important for long-term retention?",
                options: ["Cramming", "Active Recall", "Highlighting text", "Sleeping in class"],
                correctAnswerIndex: 1,
                explanation: "Active recall forces your brain to retrieve information."
            }
        ]
    };
    
    processLevelData(emergencyData);
}

function processLevelData(data) {
    levelData = data;
    
    if (!levelData.questions || levelData.questions.length === 0) {
        engageEmergencyProtocol(levelContext.topic || "General");
        return;
    }

    currentQuestions = levelData.questions;
    
    // AUTO-START QUIZ: For a "Quiz System", we skip the lesson by default
    // unless the user *wants* to read it. 
    // UX Decision: Show the "Start Quiz" button immediately in the loading/transition phase?
    // No, let's just go straight to quiz but offer a "Briefing" button in the quiz header.
    
    startQuiz(); 
}

async function preloadNextLevel() {
    const nextLevel = levelContext.level + 1;
    if (nextLevel > levelContext.totalLevels) return;
    if (levelCacheService.getLevel(levelContext.topic, nextLevel)) return;

    try {
        apiService.generateLevelQuestions({ topic: levelContext.topic, level: nextLevel, totalLevels: levelContext.totalLevels })
            .then(qData => {
                levelCacheService.saveLevel(levelContext.topic, nextLevel, { questions: qData.questions, lesson: "Loading..." });
            });
    } catch(e) {}
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
    if (timerInterval) clearInterval(timerInterval);

    answered = false;
    selectedAnswerIndex = null;
    hintUsedThisQuestion = false;
    
    if (!currentQuestions || currentQuestionIndex >= currentQuestions.length) {
        showResults();
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Q ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    elements.quizProgressBarFill.style.width = `${progress}%`;
    
    // Render Markdown in Question
    elements.quizQuestionText.innerHTML = markdownService.render(question.question);
    
    elements.quizOptionsContainer.innerHTML = '';
    
    question.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.className = 'btn option-btn';
        // Add A/B/C/D labels for better UX
        const letter = String.fromCharCode(65 + index);
        button.innerHTML = `<span class="opt-letter">${letter}</span> <span class="opt-text">${optionText}</span>`;
        button.dataset.index = index;
        elements.quizOptionsContainer.appendChild(button);
    });

    elements.submitAnswerBtn.disabled = true;
    elements.submitAnswerBtn.textContent = 'Submit';
    elements.hintBtn.disabled = false;

    startTimer();
    questionStartTime = Date.now();
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 60;
    
    elements.timerText.textContent = `${timeLeft}`;
    elements.timerText.classList.remove('panic');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        elements.timerText.textContent = `${timeLeft}`;
        
        if (timeLeft <= 10) elements.timerText.classList.add('panic');
        
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
    
    // Auto-focus submit button for keyboard users
    // elements.submitAnswerBtn.focus(); 
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo-display');
    const comboCountEl = document.getElementById('combo-count');
    
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
    if (timerInterval) clearInterval(timerInterval);
    
    answered = true;
    userAnswers[currentQuestionIndex] = selectedAnswerIndex;

    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = question.correctAnswerIndex === selectedAnswerIndex;
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    
    if (isCorrect) {
        score++;
        currentCombo++;
        let xp = hintUsedThisQuestion ? 5 : 10;
        if (timeTaken < 5) { fastAnswersCount++; xp += 5; }
        if (currentCombo > 1) { xp += (currentCombo * 2); }
        
        xpGainedThisLevel += xp;
        soundService.playSound('correct');
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

    // Reveal Colors
    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    elements.hintBtn.disabled = true;
    elements.submitAnswerBtn.textContent = currentQuestionIndex < currentQuestions.length - 1 ? 'Next Question' : 'Finish Quiz';
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
    if (passed) vfxService.burstConfetti(); 

    historyService.addQuizAttempt({
        topic: `${levelContext.topic}`,
        score: score,
        totalQuestions: total,
        startTime: Date.now(),
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
        fastAnswers: fastAnswersCount,
        questions: currentQuestions,
        userAnswers: userAnswers
    });
    
    stateService.setNavigationContext({ ...levelContext, questions: currentQuestions, userAnswers: userAnswers });

    if (passed) {
        elements.resultsTitle.textContent = 'Quiz Complete';
        elements.resultsDetails.innerHTML = `Score: <strong>${score}/${total}</strong><br><span style="color:var(--color-success)">Passed</span>`;
        elements.resultsActions.innerHTML = `
            <button id="next-level-btn" class="btn btn-primary">Next Level</button>
            <a href="#/review" class="btn">Review Answers</a>
        `;
        document.getElementById('next-level-btn').onclick = () => {
            // Increment level and restart
            levelContext.level++;
            startLevel();
        };
        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey) learningPathService.completeLevel(levelContext.journeyId);
    } else {
        elements.resultsTitle.textContent = 'Quiz Failed';
        elements.resultsDetails.innerHTML = `Score: <strong>${score}/${total}</strong><br><span style="color:var(--color-error)">Keep Practicing</span>`;
        elements.resultsActions.innerHTML = `
            <button id="retry-btn" class="btn btn-primary">Retry Quiz</button>
            <a href="#/review" class="btn">Review Mistakes</a>
        `;
        document.getElementById('retry-btn').onclick = () => startQuiz(); // Retry same questions
    }
    
    switchState('level-results-state');
    if (xpGainedThisLevel > 0) vfxService.animateNumber(elements.xpGainText, 0, xpGainedThisLevel);
}

async function handleQuit() {
    const confirmed = await showConfirmationModal({
        title: 'Quit Quiz?',
        message: 'Current progress will be lost.',
        confirmText: 'Quit',
        cancelText: 'Cancel',
        danger: true,
    });
    if (confirmed) {
        window.location.hash = '#/';
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
    } catch (e) { showToast("Hint unavailable.", "error"); }
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
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

    elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.quitBtn.addEventListener('click', handleQuit);
    elements.hintBtn.addEventListener('click', handleHintClick);
    document.getElementById('home-btn')?.addEventListener('click', handleQuit);

    startLevel();
}

export function destroy() {
    if (timerInterval) clearInterval(timerInterval);
    if (loadingTimeout) clearTimeout(loadingTimeout);
}
