import * as apiService from '../../services/apiService.js';
import * as learningPathService from '../../services/learningPathService.js';
import * as markdownService from '../../services/markdownService.js';
import * as soundService from '../../services/soundService.js';
import * as historyService from '../../services/historyService.js';
import * as levelCacheService from '../../services/levelCacheService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as stateService from '../../services/stateService.js';
import { showToast } from '../../services/toastService.js';

let levelData;
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

const PASS_THRESHOLD = 0.8; // 80% to pass
const LEVELS_PER_CHAPTER = 50; // Align with game-map logic

function announce(message, polite = false) {
    const region = polite ? elements.timerAnnouncer : elements.announcer;
    if (region) {
        region.textContent = message;
    }
}

// --- Audio Utilities ---
function decode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


function switchState(targetStateId) {
    if (targetStateId !== 'level-lesson-state' && currentAudioSource) {
        stopAudio();
    }
    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

async function startLevel() {
    const { topic, level, journeyId, isBoss, totalLevels } = levelContext;
    if (!topic || !level || !journeyId) {
        window.location.hash = '/topics';
        return;
    }
    
    // Update loading screen text based on whether it's a boss battle
    if (isBoss) {
        elements.loadingTitle.textContent = `Boss Battle!`;
        elements.loadingTitle.nextElementSibling.textContent = 'Prepare for a cumulative challenge!';
    } else {
        elements.loadingTitle.textContent = `Level ${level}: ${topic}`;
    }
    switchState('level-loading-state');

    // Check cache first. A cached boss battle will not have a 'lesson' property.
    const cachedLevel = levelCacheService.getLevel(topic, level);
    if (cachedLevel) {
        levelData = cachedLevel;
        if (isBoss) {
            startQuiz();
        } else {
            renderLesson();
        }
        return;
    }

    if (!navigator.onLine) {
        elements.loadingTitle.textContent = 'You are Offline';
        elements.loadingTitle.nextElementSibling.textContent = 'This level is not cached. Please connect to the internet to play.';
        elements.loadingTitle.parentElement.querySelector('.spinner').style.display = 'none';
        elements.cancelBtn.textContent = 'Back to Map';
        return;
    }
    
    try {
        if (isBoss) {
            const chapter = Math.ceil(level / LEVELS_PER_CHAPTER);
            levelData = await apiService.generateBossBattle({ topic, chapter });
            if (!levelData || !levelData.questions || levelData.questions.length === 0) {
                 throw new Error("AI failed to generate a valid boss battle.");
            }
            levelCacheService.saveLevel(topic, level, levelData);
            startQuiz(); // Boss battles go straight to the quiz
        } else {
            levelData = await apiService.generateLevel({ topic, level, totalLevels });
            if (!levelData || !levelData.lesson || !levelData.questions || levelData.questions.length === 0) {
                throw new Error("AI failed to generate valid level content.");
            }
            levelCacheService.saveLevel(topic, level, levelData);
            renderLesson();
        }
    } catch (error) {
        elements.loadingTitle.textContent = 'Error';
        elements.loadingTitle.nextElementSibling.textContent = error.message;
        elements.loadingTitle.parentElement.querySelector('.spinner').style.display = 'none';
        elements.cancelBtn.textContent = 'Back to Map';
    }
}


function renderLesson() {
    elements.lessonTitle.textContent = `Level ${levelContext.level}: ${levelContext.topic}`;
    elements.lessonBody.innerHTML = markdownService.render(levelData.lesson);
    if(elements.readAloudBtn) elements.readAloudBtn.disabled = false;
    switchState('level-lesson-state');
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    xpGainedThisLevel = 0; // Reset XP for the level
    renderQuestion();
    switchState('level-quiz-state');
    soundService.playSound('start');
}

function renderQuestion() {
    answered = false;
    selectedAnswerIndex = null;
    hintUsedThisQuestion = false; // Reset hint for new question
    const question = levelData.questions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${levelData.questions.length}`;
    const progress = ((currentQuestionIndex + 1) / levelData.questions.length) * 100;
    elements.quizProgressBarFill.style.width = `${progress}%`;
    
    elements.quizQuestionText.textContent = question.question;
    elements.quizOptionsContainer.innerHTML = '';
    
    question.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.className = 'btn option-btn';
        // The letter is now handled by CSS counters
        const textSpan = document.createElement('span');
        textSpan.textContent = optionText;
        button.appendChild(textSpan);
        button.dataset.index = index;
        elements.quizOptionsContainer.appendChild(button);
    });

    elements.submitAnswerBtn.disabled = true;
    elements.submitAnswerBtn.textContent = 'Submit Answer';
    
    elements.hintBtn.disabled = false;
    elements.hintBtn.innerHTML = `
        <svg class="icon"><use href="/assets/icons/feather-sprite.svg#lightbulb"/></svg>
        <span>Hint</span>
    `;

    announce(`Question ${currentQuestionIndex + 1}: ${question.question}`);
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 60;
    elements.timerText.textContent = `01:00`;
    timerInterval = setInterval(() => {
        timeLeft--;
        const seconds = String(timeLeft % 60).padStart(2, '0');
        elements.timerText.textContent = `00:${seconds}`;
        
        if (timeLeft > 0 && timeLeft % 15 === 0) {
            announce(`${timeLeft} seconds remaining`, true);
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    // Treat as incorrect answer and move on
    soundService.playSound('incorrect');
    selectedAnswerIndex = -1; // Indicate no answer was selected
    announce('Time is up.');
    handleSubmitAnswer();
}


function handleOptionClick(event) {
    const button = event.target.closest('.option-btn');
    if (answered || !button) return;

    // Deselect others
    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    
    // Select clicked
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

    const question = levelData.questions[currentQuestionIndex];
    const isCorrect = question.correctAnswerIndex === selectedAnswerIndex;
    
    if (isCorrect) {
        score++;
        const xpForThisQuestion = hintUsedThisQuestion ? 5 : 10;
        xpGainedThisLevel += xpForThisQuestion;
        soundService.playSound('correct');
        announce('Correct!');
    } else {
        soundService.playSound('incorrect');
        const correctAnswerText = question.options[question.correctAnswerIndex];
        announce(`Incorrect. The correct answer was: ${correctAnswerText}`);
    }

    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) {
            btn.classList.add('correct');
        } else if (index === selectedAnswerIndex) {
            btn.classList.add('incorrect');
        }
        btn.disabled = true;
    });

    elements.hintBtn.disabled = true; // Disable hint button after answering
    elements.submitAnswerBtn.textContent = currentQuestionIndex < levelData.questions.length - 1 ? 'Next Question' : 'Show Results';
    elements.submitAnswerBtn.disabled = false;
    elements.submitAnswerBtn.focus();
}

function handleNextQuestion() {
    if (currentQuestionIndex < levelData.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function handleReviewAnswers() {
    stateService.setNavigationContext({
        ...levelContext,
        questions: levelData.questions,
        userAnswers: userAnswers,
    });
    window.location.hash = '#/review';
}

function showResults() {
    const totalQuestions = levelData.questions.length;
    const scorePercent = totalQuestions > 0 ? (score / totalQuestions) : 0;
    const passed = scorePercent >= PASS_THRESHOLD;

    soundService.playSound('finish');
    
    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score,
        totalQuestions: totalQuestions,
        startTime: Date.now() - (totalQuestions * 60000), // Approximate
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
    });

    const xpGained = xpGainedThisLevel;
    if (xpGained > 0) {
        elements.xpGainText.textContent = `+${xpGained} XP`;
        elements.xpGainText.style.display = 'inline-block';
    } else {
        elements.xpGainText.style.display = 'none';
    }

    const reviewBtnHTML = `<button id="review-answers-btn" class="btn">Review Answers</button>`;

    if (passed) {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#check-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon passed';
        elements.resultsTitle.textContent = `Level ${levelContext.level} Complete!`;
        const resultText = `You scored ${score} out of ${totalQuestions}. Great job!`;
        elements.resultsDetails.textContent = resultText;
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-primary">Continue Journey</a> ${reviewBtnHTML}`;
        
        announce(`Level Complete! ${resultText}`);

        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey && journey.currentLevel === levelContext.level) {
            learningPathService.completeLevel(levelContext.journeyId);
        }
    } else {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#x-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon failed';
        elements.resultsTitle.textContent = 'Keep Practicing!';
        const resultText = `You scored ${score} out of ${totalQuestions}. Review the lesson and try again.`;
        elements.resultsDetails.textContent = resultText;
        elements.resultsActions.innerHTML = `
            <a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn">Back to Map</a>
            <button id="retry-level-btn" class="btn btn-primary">Try Again</button>
            ${reviewBtnHTML}
        `;
        document.getElementById('retry-level-btn').addEventListener('click', startQuiz);
        announce(`Quiz finished. ${resultText}`);
    }
    
    document.getElementById('review-answers-btn').addEventListener('click', handleReviewAnswers);
    switchState('level-results-state');
}

async function handleQuit() {
    const confirmed = await showConfirmationModal({
        title: 'Quit Quiz?',
        message: 'Are you sure you want to quit? Your progress in this level will not be saved.',
        confirmText: 'Yes, Quit',
        cancelText: 'Cancel',
        danger: true,
    });
    if (confirmed) {
        window.location.hash = `#/game/${encodeURIComponent(levelContext.topic)}`;
    }
}

async function handleHintClick() {
    if (elements.hintBtn.disabled) return;

    elements.hintBtn.disabled = true;
    elements.hintBtn.innerHTML = `<div class="btn-spinner"></div><span>Generating...</span>`;

    try {
        const question = levelData.questions[currentQuestionIndex];
        const hintData = await apiService.generateHint({
            topic: levelContext.topic,
            question: question.question,
            options: question.options
        });

        if (hintData && hintData.hint) {
            showToast(`Hint: ${hintData.hint}`, 'info', 5000); // Show for 5 seconds
            hintUsedThisQuestion = true;
        } else {
            throw new Error("Received an empty hint from the AI.");
        }
    } catch (error) {
        showToast(error.message, 'error');
        // Re-enable the button if hint generation fails
        elements.hintBtn.disabled = false;
    } finally {
        // Restore button text but keep it disabled for this question
        elements.hintBtn.innerHTML = `
            <svg class="icon"><use href="/assets/icons/feather-sprite.svg#lightbulb"/></svg>
            <span>Hint</span>
        `;
    }
}

async function handleReadAloudClick() {
    if (currentAudioSource) {
        stopAudio();
        return;
    }

    const btn = elements.readAloudBtn;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="btn-spinner"></div> <span>Synthesizing...</span>`;
    btn.classList.add('loading');

    try {
        const lessonText = elements.lessonBody.textContent;
        if (!lessonText.trim()) {
            throw new Error("No text to read.");
        }

        const response = await apiService.generateSpeech(lessonText);
        const audioData = response.audioContent;
        
        if (!outputAudioContext) {
            outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        } else if (outputAudioContext.state === 'suspended') {
            await outputAudioContext.resume();
        }

        const decoded = decode(audioData);
        const audioBuffer = await decodeAudioData(decoded, outputAudioContext, 24000, 1);
        
        currentAudioSource = outputAudioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(outputAudioContext.destination);
        
        currentAudioSource.onended = () => {
            stopAudio();
        };
        
        currentAudioSource.start();
        soundService.playSound('click');
        
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#square"/></svg> <span>Stop</span>`;
        btn.classList.remove('loading');
        btn.classList.add('playing');

    } catch (error) {
        console.error("Error generating or playing speech:", error);
        showToast(error.message, 'error');
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('loading');
    }
}

function stopAudio() {
    if (currentAudioSource) {
        currentAudioSource.stop();
        currentAudioSource.disconnect();
        currentAudioSource = null;
    }
    
    const btn = elements.readAloudBtn;
    if (btn) {
        btn.classList.remove('loading', 'playing');
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#volume-2"/></svg> <span>Read Aloud</span>`;
    }
}

function goHome() {
    window.location.hash = `/#/`;
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
        // Announcers
        announcer: document.getElementById('announcer-region'),
        timerAnnouncer: document.getElementById('timer-announcer-region'),
        // Loading
        loadingTitle: document.getElementById('loading-title'),
        cancelBtn: document.getElementById('cancel-generation-btn'),
        // Lesson
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
        startQuizBtn: document.getElementById('start-quiz-btn'),
        readAloudBtn: document.getElementById('read-aloud-btn'),
        // Quiz
        quitBtn: document.getElementById('quit-btn'),
        homeBtn: document.getElementById('home-btn'),
        hintBtn: document.getElementById('hint-btn'),
        timerText: document.getElementById('timer-text'),
        quizProgressText: document.getElementById('quiz-progress-text'),
        quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        submitAnswerBtn: document.getElementById('submit-answer-btn'),
        // Results
        resultsIcon: document.getElementById('results-icon'),
        resultsTitle: document.getElementById('results-title'),
        resultsDetails: document.getElementById('results-details'),
        resultsActions: document.getElementById('results-actions'),
        xpGainText: document.getElementById('xp-gain-text'),
    };

    elements.cancelBtn.addEventListener('click', () => window.history.back());
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.readAloudBtn.addEventListener('click', handleReadAloudClick);
    elements.readAloudBtn.disabled = true; // Disable until lesson is loaded
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    elements.quitBtn.addEventListener('click', handleQuit);
    elements.homeBtn.addEventListener('click', goHome);
    elements.hintBtn.addEventListener('click', handleHintClick);

    startLevel();
}

export function destroy() {
    clearInterval(timerInterval);
    stopAudio();
    if (outputAudioContext) {
        outputAudioContext.close().catch(e => console.error("Error closing AudioContext:", e));
        outputAudioContext = null;
    }
}