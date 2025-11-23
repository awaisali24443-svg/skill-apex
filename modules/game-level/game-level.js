

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
let keyboardHandler = null;

// Phase 3: Combo Mechanics
let comboStreak = 0;

// Boss Battle State
let bossHp = 100;
let damagePerHit = 10;

const PASS_THRESHOLD = 0.8;
const LEVELS_PER_CHAPTER = 50;

function announce(message, polite = false) {
    const region = polite ? elements.timerAnnouncer : elements.announcer;
    if (region) {
        region.textContent = message;
    }
}

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
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
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
    
    switchState('level-loading-state');

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
        showToast("You are offline", "error");
        window.history.back();
        return;
    }
    
    try {
        if (isBoss) {
            const chapter = Math.ceil(level / LEVELS_PER_CHAPTER);
            levelData = await apiService.generateBossBattle({ topic, chapter });
            if (!levelData || !levelData.questions) throw new Error("AI failed to generate a valid boss battle.");
            levelCacheService.saveLevel(topic, level, levelData);
            startQuiz();
        } else {
            levelData = await apiService.generateLevel({ topic, level, totalLevels });
            if (!levelData || !levelData.lesson || !levelData.questions) throw new Error("AI failed to generate valid level content.");
            levelCacheService.saveLevel(topic, level, levelData);
            renderLesson();
        }
    } catch (error) {
        showToast(error.message, "error");
        window.history.back();
    }
}

async function preloadNextLevel() {
    const nextLevel = levelContext.level + 1;
    if (nextLevel > levelContext.totalLevels) return; 

    if (levelCacheService.getLevel(levelContext.topic, nextLevel)) return;

    try {
        const isBoss = nextLevel % LEVELS_PER_CHAPTER === 0;
        const { topic, totalLevels } = levelContext;

        let data;
        if (isBoss) {
            const chapter = Math.ceil(nextLevel / LEVELS_PER_CHAPTER);
            data = await apiService.generateBossBattle({ topic, chapter });
        } else {
            data = await apiService.generateLevel({ topic, level: nextLevel, totalLevels });
        }

        if (data) {
            levelCacheService.saveLevel(topic, nextLevel, data);
            console.log(`[Preload] Level ${nextLevel} ready.`);
        }
    } catch (e) {
        console.warn("[Preload] Failed silently:", e);
    }
}

function renderLesson() {
    elements.lessonTitle.textContent = `Level ${levelContext.level}: ${levelContext.topic}`;
    elements.lessonBody.innerHTML = markdownService.render(levelData.lesson);
    
    // PHASE 6: Dynamic AI Image Injection
    if (elements.lessonImage && elements.lessonImageContainer) {
        const encodedTopic = encodeURIComponent(`futuristic technology illustration for ${levelContext.topic}`);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedTopic}?width=800&height=400&nologo=true&seed=${levelContext.level}`;
        
        elements.lessonImage.onload = () => {
            elements.lessonImage.style.opacity = '1';
        };
        elements.lessonImage.src = imageUrl;
        elements.lessonImageContainer.style.display = 'block';
    }

    if (window.mermaid) {
        setTimeout(() => {
            try {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            } catch(e) {
                console.error("Mermaid rendering error:", e);
            }
        }, 100);
    }

    if(elements.readAloudBtn) elements.readAloudBtn.disabled = false;
    switchState('level-lesson-state');
}

function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    comboStreak = 0;
    userAnswers = [];
    xpGainedThisLevel = 0;
    
    if (levelContext.isBoss) {
        bossHp = 100;
        damagePerHit = 100 / levelData.questions.length;
        elements.bossHealthContainer.style.display = 'flex';
        elements.bossHealthFill.style.width = '100%';
    } else {
        elements.bossHealthContainer.style.display = 'none';
    }

    renderQuestion();
    updateComboDisplay();
    switchState('level-quiz-state');
    soundService.playSound('start');
}

function updateComboDisplay() {
    if (comboStreak > 1) {
        elements.comboDisplay.style.opacity = '1';
        elements.comboDisplay.style.transform = 'scale(1.2)';
        setTimeout(() => elements.comboDisplay.style.transform = 'scale(1)', 200);
        elements.comboMultiplier.textContent = `x${comboStreak}`;
        elements.comboLabel.textContent = comboStreak > 4 ? "ON FIRE! 🔥" : "Streak!";
    } else {
        elements.comboDisplay.style.opacity = '0';
    }
}

function renderQuestion() {
    answered = false;
    selectedAnswerIndex = null;
    hintUsedThisQuestion = false;
    
    elements.feedbackContainer.style.display = 'none'; // Hide feedback from previous
    
    const question = levelData.questions[currentQuestionIndex];
    
    elements.quizProgressText.textContent = `Question ${currentQuestionIndex + 1} / ${levelData.questions.length}`;
    const progress = ((currentQuestionIndex + 1) / levelData.questions.length) * 100;
    elements.quizProgressBarFill.style.width = `${progress}%`;
    
    elements.quizQuestionText.textContent = question.question;
    elements.quizOptionsContainer.innerHTML = '';
    
    question.options.forEach((optionText, index) => {
        const button = document.createElement('button');
        button.className = 'btn option-btn';
        // Add number hint for keyboard users
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'shortcut-hint';
        shortcutSpan.textContent = `[${index + 1}]`;
        shortcutSpan.style.opacity = '0.5';
        shortcutSpan.style.marginRight = '8px';
        shortcutSpan.style.fontSize = '0.8em';

        const textSpan = document.createElement('span');
        textSpan.textContent = optionText;
        
        button.appendChild(shortcutSpan);
        button.appendChild(textSpan);
        button.dataset.index = index;
        elements.quizOptionsContainer.appendChild(button);
    });

    elements.submitAnswerBtn.disabled = true;
    elements.submitAnswerBtn.textContent = 'Submit Answer';
    elements.hintBtn.disabled = false;
    elements.hintBtn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#lightbulb"/></svg><span>Hint</span>`;

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
        if (timeLeft > 0 && timeLeft % 15 === 0) announce(`${timeLeft} seconds remaining`, true);
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    soundService.playSound('incorrect');
    selectedAnswerIndex = -1;
    announce('Time is up.');
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
    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    
    const targetBtn = elements.quizOptionsContainer.querySelector(`.option-btn[data-index="${index}"]`);
    if(targetBtn) {
        targetBtn.classList.add('selected');
        selectedAnswerIndex = index;
        elements.submitAnswerBtn.disabled = false;
    }
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
    
    // Phase 3: Instant Feedback UI
    elements.feedbackContainer.style.display = 'flex';
    elements.feedbackExplanation.textContent = question.explanation || "No explanation provided.";

    if (isCorrect) {
        score++;
        comboStreak++;
        updateComboDisplay();
        
        const xpForThisQuestion = (hintUsedThisQuestion ? 5 : 10) + (comboStreak > 1 ? comboStreak * 2 : 0);
        xpGainedThisLevel += xpForThisQuestion;
        
        soundService.playSound('correct');
        announce('Correct!');

        elements.feedbackContainer.className = 'feedback-container correct';
        elements.feedbackTitle.textContent = "Correct!";

        if (levelContext.isBoss) {
            bossHp = Math.max(0, bossHp - damagePerHit);
            elements.bossHealthFill.style.width = `${bossHp}%`;
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 500);
        }

    } else {
        comboStreak = 0;
        updateComboDisplay();
        soundService.playSound('incorrect');
        
        elements.feedbackContainer.className = 'feedback-container incorrect';
        elements.feedbackTitle.textContent = "Incorrect";
        
        const correctAnswerText = question.options[question.correctAnswerIndex];
        // Append correct answer to explanation
        elements.feedbackExplanation.innerHTML = `<strong>Answer: ${correctAnswerText}</strong><br/>${question.explanation}`;
        
        announce(`Incorrect. The correct answer was: ${correctAnswerText}`);
        
        if (levelContext.isBoss) {
            document.body.classList.add('damage-flash');
            setTimeout(() => document.body.classList.remove('damage-flash'), 500);
        }
    }

    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    elements.hintBtn.disabled = true;
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

function fireConfetti() {
    // Phase 3: Enhanced Confetti (Neon)
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00b8d4', '#9c27b0', '#ff4081', '#f50057', '#00e676', '#2979ff', '#ff9100'];

    for (let i = 0; i < 150; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            dx: (Math.random() - 0.5) * 20,
            dy: (Math.random() - 0.5) * 20,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10,
            tiltAngle: Math.random() * 10,
            tiltAngleIncremental: (Math.random() * 0.07) + 0.05
        });
    }

    let animationId;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = 0;

        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.tiltAngle) + 3 + p.h / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.x += p.dx * 0.5; 
            p.y += p.dy * 0.5;

            p.dx *= 0.9;
            p.dy *= 0.9;
            
            p.tilt = Math.sin(p.tiltAngle) * 15;

            if (p.y < canvas.height) {
                active++;
                ctx.beginPath();
                ctx.lineWidth = p.w / 2;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.w / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.h / 2);
                ctx.stroke();
            }
        });

        if (active > 0) {
            animationId = requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    animate();
    
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        if(document.body.contains(canvas)) canvas.remove();
    }, 4000);
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
        startTime: Date.now() - (totalQuestions * 60000),
        endTime: Date.now(),
        xpGained: xpGainedThisLevel,
    });

    let mistakesSaved = 0;
    levelData.questions.forEach((q, index) => {
        if (userAnswers[index] !== q.correctAnswerIndex && userAnswers[index] !== undefined) {
            if (!libraryService.isQuestionSaved(q)) {
                libraryService.saveQuestion(q); 
                mistakesSaved++;
            }
        }
    });
    if (mistakesSaved > 0) {
        showToast(`${mistakesSaved} mistake(s) saved to Library.`, 'info', 4000);
    }

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
        
        if (levelContext.isBoss) {
             elements.resultsTitle.textContent = `Boss Defeated!`;
             elements.resultsDetails.textContent = `You conquered Chapter ${Math.ceil(levelContext.level / LEVELS_PER_CHAPTER)}!`;
        } else {
             elements.resultsTitle.textContent = `Level ${levelContext.level} Complete!`;
             elements.resultsDetails.textContent = `You scored ${score} out of ${totalQuestions}.`;
        }
        
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn btn-primary">Continue Journey</a> ${reviewBtnHTML}`;
        
        const journey = learningPathService.getJourneyById(levelContext.journeyId);
        if (journey && journey.currentLevel === levelContext.level) learningPathService.completeLevel(levelContext.journeyId);

        fireConfetti();
        preloadNextLevel();

    } else {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#x-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon failed';
        
        if (levelContext.isBoss) {
             elements.resultsTitle.textContent = 'Boss Fight Failed';
             elements.resultsDetails.textContent = `The boss survived. Try again.`;
        } else {
             elements.resultsTitle.textContent = 'Keep Practicing!';
             elements.resultsDetails.textContent = `You scored ${score} out of ${totalQuestions}. Review the lesson.`;
        }
       
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn">Back to Map</a> <button id="retry-level-btn" class="btn btn-primary">Try Again</button> ${reviewBtnHTML}`;
        document.getElementById('retry-level-btn').addEventListener('click', startQuiz);
    }
    
    document.getElementById('review-answers-btn').addEventListener('click', handleReviewAnswers);
    switchState('level-results-state');
}

async function handleShare() {
    const btn = document.getElementById('share-result-btn');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="btn-spinner"></div> Capturing...`;
    btn.disabled = true;

    try {
        const elementToCapture = document.getElementById('share-capture-area');
        
        const canvas = await html2canvas(elementToCapture, {
            backgroundColor: '#0f172a', // Enforce dark theme bg for screenshot
            scale: 2, // High res
            logging: false,
            useCORS: true
        });

        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'my-quiz-victory.png', { type: 'image/png' });

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'I beat the AI Quiz Master!',
                        text: `I just scored ${score}/${levelData.questions.length} on ${levelContext.topic}!`,
                        files: [file]
                    });
                    showToast('Shared successfully!', 'success');
                } catch (err) {
                    console.log('Share cancelled or failed', err);
                    downloadImage(canvas); // Fallback
                }
            } else {
                downloadImage(canvas);
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    } catch (e) {
        console.error(e);
        showToast('Failed to capture image', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function downloadImage(canvas) {
    const link = document.createElement('a');
    link.download = `quiz-result-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showToast('Image downloaded!', 'success');
}

async function handleQuit() {
    const confirmed = await showConfirmationModal({
        title: 'Quit Quiz?',
        message: 'Your progress in this level will not be saved.',
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
    
    soundService.playSound('click');
    
    elements.hintBtn.disabled = true;
    elements.hintBtn.innerHTML = `<div class="btn-spinner"></div><span>Generating...</span>`;
    try {
        const question = levelData.questions[currentQuestionIndex];
        const hintData = await apiService.generateHint({ topic: levelContext.topic, question: question.question, options: question.options });
        if (hintData && hintData.hint) {
            showToast(`Hint: ${hintData.hint}`, 'info', 5000);
            hintUsedThisQuestion = true;
        }
    } catch (error) {
        showToast(error.message, 'error');
        elements.hintBtn.disabled = false;
    } finally {
        elements.hintBtn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#lightbulb"/></svg><span>Hint</span>`;
    }
}

async function handleAskAI() {
    const selection = window.getSelection().toString().trim();
    const concept = selection || prompt("What concept would you like explained?");
    
    if (!concept) return;

    elements.askAiContainer.style.display = 'block';
    elements.askAiAnswer.innerHTML = '<div class="spinner"></div> Analyzing...';
    
    try {
        const result = await apiService.explainConcept(levelContext.topic, concept, levelData.lesson);
        elements.askAiAnswer.textContent = result.explanation;
    } catch (e) {
        elements.askAiAnswer.textContent = "Could not generate explanation. Please try again.";
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
        const response = await apiService.generateSpeech(lessonText);
        const audioData = response.audioContent;
        
        if (!outputAudioContext) outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        else if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();

        const decoded = decode(audioData);
        const audioBuffer = await decodeAudioData(decoded, outputAudioContext, 24000, 1);
        currentAudioSource = outputAudioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(outputAudioContext.destination);
        currentAudioSource.onended = () => stopAudio();
        currentAudioSource.start();
        
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#square"/></svg> <span>Stop</span>`;
        btn.classList.remove('loading');
        btn.classList.add('playing');
    } catch (error) {
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

// Global Keyboard Handler for Pro Users
function handleGlobalKeydown(e) {
    if (document.getElementById('level-quiz-state').classList.contains('active')) {
        // Selection Logic (1-4)
        if (['1', '2', '3', '4'].includes(e.key)) {
            const idx = parseInt(e.key) - 1;
            selectOption(idx);
        }
        // Submit Logic (Enter)
        if (e.key === 'Enter') {
            if (!elements.submitAnswerBtn.disabled) {
                handleSubmitAnswer();
            }
        }
    } else if (document.getElementById('level-results-state').classList.contains('active')) {
        // Share Logic (S)
        if (e.key.toLowerCase() === 's') {
            handleShare();
        }
    } else if (document.getElementById('level-lesson-state').classList.contains('active')) {
         // Start Logic (Enter)
         if (e.key === 'Enter') {
            startQuiz();
         }
    }
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
        announcer: document.getElementById('announcer-region'),
        timerAnnouncer: document.getElementById('timer-announcer-region'),
        cancelBtn: document.getElementById('cancel-generation-btn'),
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
        lessonImage: document.getElementById('lesson-image'), // PHASE 6
        lessonImageContainer: document.getElementById('lesson-image-container'), // PHASE 6
        startQuizBtn: document.getElementById('start-quiz-btn'),
        readAloudBtn: document.getElementById('read-aloud-btn'),
        askAiBtn: document.getElementById('ask-ai-btn'),
        askAiContainer: document.getElementById('ask-ai-container'),
        askAiAnswer: document.getElementById('ask-ai-answer'),
        closeAskAiBtn: document.getElementById('close-ask-ai-btn'),
        quitBtn: document.getElementById('quit-btn'),
        homeBtn: document.getElementById('home-btn'),
        hintBtn: document.getElementById('hint-btn'),
        timerText: document.getElementById('timer-text'),
        quizProgressText: document.getElementById('quiz-progress-text'),
        quizProgressBarFill: document.getElementById('quiz-progress-bar-fill'),
        quizQuestionText: document.getElementById('quiz-question-text'),
        quizOptionsContainer: document.getElementById('quiz-options-container'),
        submitAnswerBtn: document.getElementById('submit-answer-btn'),
        resultsIcon: document.getElementById('results-icon'),
        resultsTitle: document.getElementById('results-title'),
        resultsDetails: document.getElementById('results-details'),
        resultsActions: document.getElementById('results-actions'),
        xpGainText: document.getElementById('xp-gain-text'),
        bossHealthContainer: document.getElementById('boss-health-container'),
        bossHealthFill: document.getElementById('boss-health-fill'),
        shareBtn: document.getElementById('share-result-btn'),
        // Phase 3 Elements
        comboDisplay: document.getElementById('combo-display'),
        comboMultiplier: document.querySelector('.combo-multiplier'),
        comboLabel: document.querySelector('.combo-label'),
        feedbackContainer: document.getElementById('feedback-container'),
        feedbackTitle: document.getElementById('feedback-title'),
        feedbackExplanation: document.getElementById('feedback-explanation')
    };

    elements.cancelBtn.addEventListener('click', () => window.history.back());
    elements.startQuizBtn.addEventListener('click', startQuiz);
    elements.readAloudBtn.addEventListener('click', handleReadAloudClick);
    elements.readAloudBtn.disabled = true;
    elements.askAiBtn.addEventListener('click', handleAskAI);
    elements.closeAskAiBtn.addEventListener('click', () => elements.askAiContainer.style.display = 'none');
    elements.quizOptionsContainer.addEventListener('click', handleOptionClick);
    elements.submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    elements.quitBtn.addEventListener('click', handleQuit);
    elements.homeBtn.addEventListener('click', () => window.location.hash = '/#/');
    elements.hintBtn.addEventListener('click', handleHintClick);
    if(elements.shareBtn) elements.shareBtn.addEventListener('click', handleShare);

    keyboardHandler = handleGlobalKeydown;
    document.addEventListener('keydown', keyboardHandler);

    startLevel();
}

export function destroy() {
    clearInterval(timerInterval);
    stopAudio();
    if (outputAudioContext) {
        outputAudioContext.close().catch(e => console.error(e));
        outputAudioContext = null;
    }
    if (keyboardHandler) {
        document.removeEventListener('keydown', keyboardHandler);
    }
}
