
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

let levelData = {}; // Stores lesson + questions
let masterQuestionsList = []; // Stores all generated questions
let currentAttemptSet = 0; 
let currentQuestions = []; 

// Interactive Challenge State
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

// Drag and Drop State
let dragStartIndex = null;

// Typewriter
let typewriterInterval = null;
let isTyping = false;

const PASS_THRESHOLD = 0.8;
const LEVELS_PER_CHAPTER = 50;
const STANDARD_QUESTIONS_PER_ATTEMPT = 3;
const BOSS_TIME_LIMIT = 39; 

const LOADING_MESSAGES = [
    "Scanning Topic Topology...",
    "Generating Contextual Scenarios...",
    "Calibrating Difficulty Matrix...",
    "Drafting Mission Briefing...",
    "Finalizing Level Assets..."
];

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
    
    // Stop loading animation if leaving loading state
    if (targetStateId !== 'level-loading-state') {
        stopLoadingAnimation();
    }

    document.querySelectorAll('.game-level-state').forEach(s => s.classList.remove('active'));
    document.getElementById(targetStateId)?.classList.add('active');
}

function startLoadingAnimation() {
    if (loadingTextInterval) clearInterval(loadingTextInterval);
    let index = 0;
    // Reset to initial text
    if(elements.loadingText) elements.loadingText.textContent = "Initializing Module...";
    
    // Faster interval (1000ms instead of 1500ms) to make it feel snappier
    loadingTextInterval = setInterval(() => {
        if (elements.loadingText && document.body.contains(elements.loadingText)) {
            elements.loadingText.style.opacity = 0;
            setTimeout(() => {
                if (elements.loadingText && document.body.contains(elements.loadingText)) {
                    elements.loadingText.textContent = LOADING_MESSAGES[index];
                    elements.loadingText.style.opacity = 1;
                    index = (index + 1) % LOADING_MESSAGES.length;
                }
            }, 150); // Faster fade toggle
        } else {
            // Cleanup if element is gone
            stopLoadingAnimation();
        }
    }, 1000);
}

function stopLoadingAnimation() {
    if (loadingTextInterval) {
        clearInterval(loadingTextInterval);
        loadingTextInterval = null;
    }
}

/**
 * Starts the level loading process.
 * @param {boolean} forceRefresh - If true, ignores cache and requests new questions from AI.
 */
async function startLevel(forceRefresh = false) {
    const { topic, level, journeyId, isBoss, totalLevels } = levelContext;
    
    // Reset state
    retryGenerationPromise = null;
    if (lessonAbortController) {
        lessonAbortController.abort(); 
    }
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

    // Determine if this is an Interactive Challenge
    if (level % 5 === 0 && !isBoss) {
        isInteractiveLevel = true;
    }
    
    // Show loading screen
    switchState('level-loading-state');
    startLoadingAnimation();
    
    elements.skipPopup.style.display = 'none'; // Hide skip initially

    let partialCacheHit = false;

    // If NOT forcing refresh, try to load from cache first
    if (!forceRefresh) {
        const cachedLevel = levelCacheService.getLevel(topic, level);
        
        if (cachedLevel) {
            // Check based on level type
            if (isInteractiveLevel && cachedLevel.challengeType) {
                levelData = cachedLevel;
                interactiveData = cachedLevel;
                if (cachedLevel.lesson) {
                    renderLesson();
                } else {
                    startQuiz(); 
                }
                return;
            } else if (!isInteractiveLevel && cachedLevel.questions) {
                 // Standard Level Logic
                if (isBoss || cachedLevel.lesson) {
                    levelData = cachedLevel;
                    masterQuestionsList = levelData.questions || [];
                    if (isBoss) {
                        startQuiz();
                    } else {
                        renderLesson();
                    }
                    return;
                }
                levelData.questions = cachedLevel.questions;
                masterQuestionsList = cachedLevel.questions;
                partialCacheHit = true;
            }
        }
    }

    if (!navigator.onLine && !partialCacheHit) {
        showToast("You are offline", "error");
        window.history.back();
        return;
    }
    
    try {
        if (isBoss) {
            const chapter = Math.ceil(level / LEVELS_PER_CHAPTER);
            levelData = await apiService.generateBossBattle({ topic, chapter });
            if (!levelData || !levelData.questions) throw new Error("AI failed to generate a valid boss battle.");
            masterQuestionsList = levelData.questions;
            levelCacheService.saveLevel(topic, level, levelData);
            startQuiz();
        
        } else if (isInteractiveLevel) {
            // --- INTERACTIVE LEVEL GENERATION ---
            lessonAbortController = new AbortController();
            const promises = [];
            
            // 1. Challenge Data
            if (!partialCacheHit) {
                promises.push(apiService.generateInteractiveLevel({ topic, level }).then(data => {
                    interactiveData = data;
                    levelData = { ...interactiveData };
                    levelCacheService.saveLevel(topic, level, levelData);
                    // Enable "skip" to challenge once ready
                    if (elements.skipPopup) elements.skipPopup.style.display = 'block';
                }));
            }
            
            // 2. Lesson Data
            promises.push(apiService.generateLevelLesson({ 
                topic, level, totalLevels, questions: null, signal: lessonAbortController.signal 
            }).then(lData => {
                levelData.lesson = lData.lesson;
                levelCacheService.saveLevel(topic, level, levelData);
            }).catch(e => console.warn("Lesson gen skipped or failed", e)));

            await Promise.allSettled(promises);
            
            if (!skippedLesson && levelData.lesson) {
                renderLesson();
            } else {
                startQuiz();
            }

        } else {
            // --- STANDARD MCQ GENERATION (PARALLELIZED) ---
            lessonAbortController = new AbortController();
            const promises = [];

            // 1. Generate Questions (The Test)
            if (!partialCacheHit) {
                promises.push(apiService.generateLevelQuestions({ topic, level, totalLevels }).then(qData => {
                    if (!qData || !qData.questions) throw new Error("Failed to generate questions.");
                    masterQuestionsList = qData.questions;
                    levelData.questions = masterQuestionsList;
                    levelCacheService.saveLevel(topic, level, levelData);
                    
                    // Enable "Skip to Quiz" immediately when questions are ready
                    // This is the HOT SWAP feature.
                    if (elements.skipPopup) elements.skipPopup.style.display = 'block';
                }));
            } else {
                if (elements.skipPopup) elements.skipPopup.style.display = 'block';
            }

            // 2. Generate Lesson (The Teaching)
            promises.push(apiService.generateLevelLesson({ 
                topic, level, totalLevels, questions: null, signal: lessonAbortController.signal 
            }).then(lData => {
                levelData.lesson = lData.lesson;
                levelCacheService.saveLevel(topic, level, levelData);
            }).catch(err => {
                if (err.name !== 'AbortError') console.warn("Lesson generation error:", err);
            }));

            // Wait for everything
            await Promise.allSettled(promises);

            if (!skippedLesson) {
                if (levelData.lesson) {
                    renderLesson();
                } else {
                    if (masterQuestionsList.length > 0) {
                        showToast("Lesson unavailable, starting quiz.", "info");
                        startQuiz();
                    } else {
                        throw new Error("Level generation failed.");
                    }
                }
            }
        }

    } catch (error) {
        showToast(error.message, "error");
        window.history.back();
    }
}

/**
 * Triggered on the first incorrect answer (or interact failure).
 * Generates the *next* attempt's data in the background.
 */
function triggerRetryGeneration() {
    if (retryGenerationPromise) return; // Already fetching

    const isBoss = levelContext.isBoss;
    const { topic, level, totalLevels } = levelContext;

    // Check if we really need to fetch
    if (!isInteractiveLevel) {
        const questionsNeeded = isBoss ? 10 : STANDARD_QUESTIONS_PER_ATTEMPT;
        const remainingQuestions = masterQuestionsList.length - ((currentAttemptSet + 1) * questionsNeeded);
        if (remainingQuestions >= questionsNeeded) return;
    }

    console.log("Prefetching fallback retry level...");

    let generator;
    if (isBoss) {
        generator = apiService.generateBossBattle({ topic, chapter: Math.ceil(level/LEVELS_PER_CHAPTER) });
    } else if (isInteractiveLevel) {
        // Support retry for interactive
        generator = apiService.generateInteractiveLevel({ topic, level });
    } else {
        generator = apiService.generateLevelQuestions({ topic, level, totalLevels });
    }

    retryGenerationPromise = generator
        .then(data => {
            console.log("Fallback retry data prefetched successfully.");
            if (!isBoss && !isInteractiveLevel) {
                return { questions: data.questions, lesson: levelData.lesson };
            }
            return data;
        })
        .catch(err => {
            console.error("Prefetch failed", err);
            return null;
        });
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
        } else if (nextLevel % 5 === 0) {
             const iData = await apiService.generateInteractiveLevel({ topic, level: nextLevel });
             const lData = await apiService.generateLevelLesson({ topic, level: nextLevel, totalLevels, questions: null });
             data = { ...iData, ...lData }; 
        } else {
            const [qData, lData] = await Promise.all([
                apiService.generateLevelQuestions({ topic, level: nextLevel, totalLevels }),
                apiService.generateLevelLesson({ topic, level: nextLevel, totalLevels, questions: null })
            ]);
            data = { ...qData, ...lData };
        }

        if (data) {
            levelCacheService.saveLevel(topic, nextLevel, data);
            console.log(`[Preload] Level ${nextLevel} ready.`);
        }
    } catch (e) {
        console.warn("[Preload] Failed silently:", e);
    }
}

// --- TYPEWRITER RENDERER ---
function renderLessonTypewriter(htmlContent) {
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    const container = elements.lessonBody;
    container.innerHTML = ''; 
    container.classList.add('typewriter-cursor');
    
    container.innerHTML = htmlContent;
    const allTextNodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while(node = walker.nextNode()) allTextNodes.push(node);
    
    const originalTexts = allTextNodes.map(n => n.textContent);
    allTextNodes.forEach(n => n.textContent = '');
    
    isTyping = true;
    let nodeIndex = 0;
    let charIndex = 0;
    
    elements.lessonBody.onclick = () => {
        if (isTyping) {
            clearInterval(typewriterInterval);
            isTyping = false;
            container.classList.remove('typewriter-cursor');
            allTextNodes.forEach((n, i) => n.textContent = originalTexts[i]);
            if (window.mermaid) mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        }
    };

    typewriterInterval = setInterval(() => {
        if (nodeIndex >= allTextNodes.length) {
            clearInterval(typewriterInterval);
            isTyping = false;
            container.classList.remove('typewriter-cursor');
            if (window.mermaid) mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            return;
        }
        
        const currentNode = allTextNodes[nodeIndex];
        const fullText = originalTexts[nodeIndex];
        
        if (charIndex < fullText.length) {
            currentNode.textContent += fullText[charIndex];
            charIndex++;
            container.scrollTop = container.scrollHeight;
        } else {
            nodeIndex++;
            charIndex = 0;
        }
    }, 3); // EXTREME SPEED (3ms) for demos
}

function renderLesson() {
    if (!levelData.lesson) return; 

    // Expo Polish: "Mission Briefing" instead of "Lesson"
    elements.lessonTitle.textContent = `Level ${levelContext.level}: Mission Briefing`;
    const rawHtml = markdownService.render(levelData.lesson);
    
    if(elements.readAloudBtn) elements.readAloudBtn.disabled = false;
    switchState('level-lesson-state');
    
    renderLessonTypewriter(rawHtml);
}

// --- ANTI-CHEAT SYSTEM ---
function activateAntiCheat() {
    if (antiCheatHandler) return; 

    showToast("⚠️ FOCUS MODE ACTIVE: Leaving this tab may cause failure.", "error", 5000);
    
    antiCheatHandler = () => {
        if (document.hidden) {
            focusTimeout = setTimeout(() => {
                if (focusStrikes === 0) {
                    focusStrikes++;
                    soundService.playSound('incorrect');
                    timeLeft = Math.max(0, timeLeft - 5);
                    const seconds = String(timeLeft % 60).padStart(2, '0');
                    if (elements.timerText) {
                        elements.timerText.textContent = `00:${seconds}`;
                        elements.timerText.style.color = '#ff0000'; 
                        setTimeout(() => {
                             if(elements.timerText) elements.timerText.style.color = '#ff4040';
                        }, 1000);
                    }
                    showToast("⚠️ FOCUS LOST > 3s: -5 Seconds Penalty!", "error", 4000);

                    if (timeLeft <= 0) {
                         clearInterval(timerInterval);
                         handleTimeUp();
                         removeAntiCheat();
                    }

                } else {
                    soundService.playSound('incorrect');
                    score = 0; 
                    clearInterval(timerInterval);
                    announce('Focus lost. Battle failed.');
                    showResults(false, true); 
                }
            }, 3000); 

        } else {
            if (focusTimeout) {
                clearTimeout(focusTimeout);
                focusTimeout = null;
                showToast("⚠️ Focus restored. Stay on this tab!", "info", 2000);
            }

            if (focusStrikes === 1) {
                if(!elements.resultsTitle.textContent) { 
                    showConfirmationModal({
                        title: '⚠️ BATTLEFIELD WARNING',
                        message: '<strong style="color:var(--color-error)">FOCUS LOST! (-5s Penalty)</strong><br><br>The Boss has noticed your distraction (away > 3s).<br>If you leave this tab <strong>one more time</strong>, you will instantly forfeit the battle.',
                        confirmText: 'I Understand',
                        cancelText: 'Surrender', 
                        danger: true
                    }).then(confirmed => {
                        if (!confirmed) {
                            showResults(false, true);
                        }
                    });
                }
            }
        }
    };
    
    document.addEventListener('visibilitychange', antiCheatHandler);
}

function removeAntiCheat() {
    if (focusTimeout) {
        clearTimeout(focusTimeout);
        focusTimeout = null;
    }
    if (antiCheatHandler) {
        document.removeEventListener('visibilitychange', antiCheatHandler);
        antiCheatHandler = null;
    }
}

function startQuiz() {
    skippedLesson = true;
    if (lessonAbortController) {
        lessonAbortController.abort();
        lessonAbortController = null;
    }

    currentQuestionIndex = 0;
    score = 0;
    focusStrikes = 0; 
    userAnswers = [];
    xpGainedThisLevel = 0;
    
    elements.bossHealthContainer.style.display = 'none';

    if (isInteractiveLevel) {
        // --- INTERACTIVE MODE ---
        elements.questionContainer.style.display = 'none';
        elements.interactiveContainer.style.display = 'block';
        elements.interactiveInstruction.textContent = interactiveData.instruction;
        
        elements.quizProgressText.textContent = "Challenge Mode";
        elements.quizProgressBarFill.style.width = "100%";
        
        renderInteractiveChallenge();
        
        elements.submitAnswerBtn.textContent = 'Verify Solution';
        elements.submitAnswerBtn.disabled = false;
        
        elements.hintBtn.disabled = true; 
        
        switchState('level-quiz-state');
        soundService.playSound('start');
        startTimer(); 
        return;
    }

    // --- STANDARD MCQ MODE ---
    elements.interactiveContainer.style.display = 'none';
    elements.questionContainer.style.display = 'block';

    if (levelContext.isBoss) {
        currentQuestions = masterQuestionsList;
        bossHp = 100;
        damagePerHit = 100 / currentQuestions.length;
        elements.bossHealthContainer.style.display = 'flex';
        elements.bossHealthFill.style.width = '100%';
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
    soundService.playSound('start');
}

// --- INTERACTIVE RENDERING ---
let selectedMatchItem = null; 

function renderInteractiveChallenge() {
    const container = document.getElementById('interactive-playground');
    container.innerHTML = '';
    
    const canDrag = window.matchMedia('(pointer: fine)').matches;
    
    if (interactiveData.challengeType === 'sequence') {
        if (interactiveUserState.length === 0) {
            interactiveUserState = [...interactiveData.items].sort(() => Math.random() - 0.5);
        }
        
        interactiveUserState.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'sortable-item';
            el.dataset.id = item.id;
            el.dataset.index = index;
            el.innerHTML = `<div class="sort-index">${index + 1}</div><span class="sort-content">${item.text}</span>`;
            
            if (canDrag) {
                el.draggable = true;
                el.addEventListener('dragstart', handleDragStart);
                el.addEventListener('dragover', handleDragOver);
                el.addEventListener('drop', handleDrop);
                el.addEventListener('dragenter', handleDragEnter);
                el.addEventListener('dragleave', handleDragLeave);
            }

            el.addEventListener('click', () => handleSequenceClick(index));
            
            container.appendChild(el);
        });

    } else if (interactiveData.challengeType === 'match') {
        interactiveUserState = []; 
        selectedMatchItem = null;
        
        const leftCol = document.createElement('div'); leftCol.className = 'match-column';
        const rightCol = document.createElement('div'); rightCol.className = 'match-column';
        
        const leftItems = [...interactiveData.items].sort(() => Math.random() - 0.5);
        const rightItems = [...interactiveData.items].sort(() => Math.random() - 0.5);
        
        leftItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.dataset.id = item.id;
            el.dataset.side = 'left';
            el.textContent = item.text;
            el.addEventListener('click', (e) => handleMatchClick(e, item.id, 'left'));
            leftCol.appendChild(el);
        });

        rightItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.dataset.id = item.id; 
            el.dataset.side = 'right';
            el.textContent = item.match; 
            el.addEventListener('click', (e) => handleMatchClick(e, item.id, 'right'));
            rightCol.appendChild(el);
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'match-container';
        wrapper.appendChild(leftCol);
        wrapper.appendChild(rightCol);
        container.appendChild(wrapper);
    }
}

// --- Drag & Drop Handlers ---
function handleDragStart(e) {
    if (answered) {
        e.preventDefault();
        return;
    }
    dragStartIndex = +e.target.closest('.sortable-item').dataset.index;
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('.sortable-item').classList.add('dragging');
}

function handleDragOver(e) {
    if (answered) return;
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    if (answered) return;
    e.preventDefault();
    const item = e.target.closest('.sortable-item');
    if (item && +item.dataset.index !== dragStartIndex) {
        item.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const item = e.target.closest('.sortable-item');
    if (item) item.classList.remove('drag-over');
}

function handleDrop(e) {
    if (answered) return;
    e.preventDefault();
    
    document.querySelectorAll('.sortable-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });

    const dragEndItem = e.target.closest('.sortable-item');
    if (!dragEndItem) return; 

    const dragEndIndex = +dragEndItem.dataset.index;

    if (dragStartIndex !== null && dragStartIndex !== dragEndIndex) {
        const itemToMove = interactiveUserState[dragStartIndex];
        interactiveUserState.splice(dragStartIndex, 1);
        interactiveUserState.splice(dragEndIndex, 0, itemToMove);
        
        soundService.playSound('click');
        renderInteractiveChallenge(); 
    }
    dragStartIndex = null;
}

// --- Tap/Click Handlers ---
let selectedSequenceIndex = null;
function handleSequenceClick(index) {
    if (answered) return;
    
    const items = document.querySelectorAll('.sortable-item');
    
    if (selectedSequenceIndex === null) {
        selectedSequenceIndex = index;
        items[index].classList.add('selected');
    } else if (selectedSequenceIndex === index) {
        items[index].classList.remove('selected');
        selectedSequenceIndex = null;
    } else {
        const temp = interactiveUserState[selectedSequenceIndex];
        interactiveUserState[selectedSequenceIndex] = interactiveUserState[index];
        interactiveUserState[index] = temp;
        
        selectedSequenceIndex = null;
        renderInteractiveChallenge(); 
        soundService.playSound('click');
    }
}

function handleMatchClick(e, id, side) {
    if (answered) return;
    const el = e.target.closest('.match-item');
    
    if (el.classList.contains('matched')) return;

    if (selectedMatchItem && selectedMatchItem.el === el) {
        el.classList.remove('selected');
        selectedMatchItem = null;
        return;
    }

    if (selectedMatchItem) {
        if (selectedMatchItem.side === side) {
            selectedMatchItem.el.classList.remove('selected');
            el.classList.add('selected');
            selectedMatchItem = { el, id, side };
            return;
        }
        
        const isMatch = selectedMatchItem.id === id; 
        
        if (isMatch) {
            el.classList.add('matched');
            selectedMatchItem.el.classList.add('matched');
            interactiveUserState.push(id); 
            soundService.playSound('correct');
        } else {
            el.classList.add('incorrect');
            selectedMatchItem.el.classList.add('incorrect');
            soundService.playSound('incorrect');
            setTimeout(() => {
                el.classList.remove('incorrect');
                if(selectedMatchItem) selectedMatchItem.el.classList.remove('incorrect');
            }, 500);
        }
        
        selectedMatchItem.el.classList.remove('selected');
        selectedMatchItem = null;
        
        if (interactiveUserState.length === interactiveData.items.length) {
            submitInteractive();
        }

    } else {
        el.classList.add('selected');
        selectedMatchItem = { el, id, side };
    }
}

function submitInteractive() {
    clearInterval(timerInterval);
    answered = true;
    let isCorrect = false;

    if (interactiveData.challengeType === 'sequence') {
        const correctOrder = interactiveData.items.map(i => i.id);
        const userOrder = interactiveUserState.map(i => i.id);
        isCorrect = JSON.stringify(correctOrder) === JSON.stringify(userOrder);
        
        const domItems = document.querySelectorAll('.sortable-item');
        domItems.forEach((el, i) => {
            if (userOrder[i] === correctOrder[i]) el.classList.add('correct');
            else el.classList.add('incorrect');
        });
    } else {
        isCorrect = interactiveUserState.length === interactiveData.items.length;
    }

    if (isCorrect) {
        score = 1; 
        xpGainedThisLevel = 50; 
        soundService.playSound('achievement');
        announce('Challenge Complete!');
        showResults(true); 
    } else {
        score = 0;
        soundService.playSound('incorrect');
        announce('Challenge Failed.');
        triggerRetryGeneration(); 
        showResults(true);
    }
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
    elements.submitAnswerBtn.textContent = 'Submit Answer';
    elements.hintBtn.disabled = false;
    elements.hintBtn.innerHTML = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#lightbulb"/></svg><span>Hint</span>`;

    announce(`Question ${currentQuestionIndex + 1}: ${question.question}`);
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = (levelContext.isBoss && !isInteractiveLevel) ? BOSS_TIME_LIMIT : 60;
    
    const displayTime = timeLeft < 10 ? `00:0${timeLeft}` : `00:${timeLeft}`;
    elements.timerText.textContent = displayTime;
    
    if (levelContext.isBoss) elements.timerText.style.color = '#ff4040';
    else elements.timerText.style.color = 'var(--color-primary)';

    timerInterval = setInterval(() => {
        timeLeft--;
        const seconds = String(timeLeft % 60).padStart(2, '0');
        elements.timerText.textContent = `00:${seconds}`;
        if (timeLeft > 0 && timeLeft <= 10) announce(`${timeLeft} seconds remaining`, true);
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
    if (isInteractiveLevel) {
        submitInteractive();
    } else {
        handleSubmitAnswer();
    }
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
    if (isInteractiveLevel) {
        submitInteractive();
        return;
    }

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
        const xpForThisQuestion = hintUsedThisQuestion ? 5 : 10;
        xpGainedThisLevel += xpForThisQuestion;
        soundService.playSound('correct');
        announce('Correct!');

        if (levelContext.isBoss) {
            bossHp = Math.max(0, bossHp - damagePerHit);
            elements.bossHealthFill.style.width = `${bossHp}%`;
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 500);
        }

    } else {
        soundService.playSound('incorrect');
        const correctAnswerText = question.options[question.correctAnswerIndex];
        announce(`Incorrect. The correct answer was: ${correctAnswerText}`);
        
        if (levelContext.isBoss) {
            document.body.classList.add('damage-flash');
            setTimeout(() => document.body.classList.remove('damage-flash'), 500);
        }

        triggerRetryGeneration();
    }

    elements.quizOptionsContainer.querySelectorAll('.option-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedAnswerIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    elements.hintBtn.disabled = true;
    elements.submitAnswerBtn.textContent = currentQuestionIndex < currentQuestions.length - 1 ? 'Next Question' : 'Show Results';
    elements.submitAnswerBtn.disabled = false;
    elements.submitAnswerBtn.focus();
}

function handleNextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function handleReviewAnswers() {
    stateService.setNavigationContext({
        ...levelContext,
        questions: currentQuestions,
        userAnswers: userAnswers,
    });
    window.location.hash = '#/review';
}

function fireConfetti() {
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

async function handleRetryClick(e) {
    const btn = e.target;
    
    const canInstantRetry = !levelContext.isBoss && !isInteractiveLevel && ((currentAttemptSet + 1) * STANDARD_QUESTIONS_PER_ATTEMPT < masterQuestionsList.length);
    
    if (canInstantRetry) {
        currentAttemptSet++;
        startQuiz();
        return;
    }

    if (retryGenerationPromise) {
        btn.disabled = true;
        btn.innerHTML = `<div class="btn-spinner"></div> Loading...`;
        
        try {
            const data = await retryGenerationPromise;
            if (data) {
                levelData = data;
                if (isInteractiveLevel) {
                    interactiveData = data;
                    interactiveUserState = []; 
                } else {
                    masterQuestionsList = levelData.questions || [];
                    currentAttemptSet = 0;
                }
                levelCacheService.saveLevel(levelContext.topic, levelContext.level, data);
                retryGenerationPromise = null;
                startQuiz();
                return;
            }
        } catch (e) {
            console.error("Retry prefetch failed", e);
        }
    }

    if (elements.loadingText) elements.loadingText.textContent = isInteractiveLevel ? "Rebuilding Challenge..." : "Regenerating Level...";
    elements.skipPopup.style.display = 'none';
    switchState('level-loading-state');
    startLevel(true);
}

function showResults(isInteractive = false, isAntiCheatForfeit = false) {
    removeAntiCheat(); 
    
    let passed = false;
    let totalQuestions = 1;

    if (isInteractive) {
        passed = score === 1; 
        totalQuestions = 1;
    } else {
        totalQuestions = currentQuestions.length;
        const scorePercent = totalQuestions > 0 ? (score / totalQuestions) : 0;
        passed = scorePercent >= PASS_THRESHOLD;
    }
    
    if (isAntiCheatForfeit) {
        passed = false;
    }

    soundService.playSound(passed ? 'finish' : 'incorrect');
    
    historyService.addQuizAttempt({
        topic: `${levelContext.topic} - Level ${levelContext.level}`,
        score: score,
        totalQuestions: totalQuestions,
        startTime: Date.now() - (60000), 
        endTime: Date.now(),
        xpGained: isAntiCheatForfeit ? 0 : xpGainedThisLevel,
    });

    if (!isInteractive && !isAntiCheatForfeit) {
        let mistakesSaved = 0;
        currentQuestions.forEach((q, index) => {
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
    }

    const xpGained = isAntiCheatForfeit ? 0 : xpGainedThisLevel;
    if (xpGained > 0) {
        elements.xpGainText.textContent = `+${xpGained} XP`;
        elements.xpGainText.style.display = 'inline-block';
    } else {
        elements.xpGainText.style.display = 'none';
    }

    const reviewBtnHTML = (isInteractive || isAntiCheatForfeit) ? '' : `<button id="review-answers-btn" class="btn">Review Answers</button>`;

    if (passed) {
        elements.resultsIcon.innerHTML = `<svg><use href="/assets/icons/feather-sprite.svg#check-circle"/></svg>`;
        elements.resultsIcon.className = 'results-icon passed';
        
        if (levelContext.isBoss) {
             elements.resultsTitle.textContent = `Boss Defeated!`;
             elements.resultsDetails.textContent = `You conquered Chapter ${Math.ceil(levelContext.level / LEVELS_PER_CHAPTER)}!`;
        } else {
             elements.resultsTitle.textContent = `Level ${levelContext.level} Complete!`;
             elements.resultsDetails.textContent = isInteractive ? 'Challenge Mastered!' : `You scored ${score} out of ${totalQuestions}.`;
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
             if (isAntiCheatForfeit) {
                 elements.resultsTitle.textContent = 'FOCUS LOST';
                 elements.resultsDetails.textContent = `Anti-Cheat Protocol engaged. You left the battlefield.`;
             } else {
                 elements.resultsTitle.textContent = 'Boss Fight Failed';
                 elements.resultsDetails.textContent = `The boss survived. Try again.`;
             }
        } else {
             elements.resultsTitle.textContent = 'Keep Practicing!';
             elements.resultsDetails.textContent = isInteractive ? 'Solution Incorrect.' : `You scored ${score} out of ${totalQuestions}. Review the lesson.`;
        }
       
        const canInstantRetry = !levelContext.isBoss && !isInteractive && !isAntiCheatForfeit && ((currentAttemptSet + 1) * STANDARD_QUESTIONS_PER_ATTEMPT < masterQuestionsList.length);
        
        const retryText = canInstantRetry ? "Try Again (Instant)" : "Try Again";
        
        elements.resultsActions.innerHTML = `<a href="#/game/${encodeURIComponent(levelContext.topic)}" class="btn">Back to Map</a> <button id="retry-level-btn" class="btn btn-primary">${retryText}</button> ${reviewBtnHTML}`;
        
        const retryBtn = document.getElementById('retry-level-btn');
        if(retryBtn) {
            retryBtn.onclick = handleRetryClick;
        }
    }
    
    if (document.getElementById('review-answers-btn')) {
        document.getElementById('review-answers-btn').addEventListener('click', handleReviewAnswers);
    }
    switchState('level-results-state');
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
        const question = currentQuestions[currentQuestionIndex];
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
        const context = levelData.lesson || `Context: Quiz on ${levelContext.topic}`;
        const result = await apiService.explainConcept(levelContext.topic, concept, context);
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
        if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();

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

function handleSkipToQuiz() {
    startQuiz();
}

export function init() {
    const { navigationContext } = stateService.getState();
    levelContext = navigationContext;

    elements = {
        announcer: document.getElementById('announcer-region'),
        timerAnnouncer: document.getElementById('timer-announcer-region'),
        cancelBtn: document.getElementById('cancel-generation-btn'),
        loadingText: document.getElementById('loading-status-text'),
        skipPopup: document.getElementById('skip-lesson-popup'),
        skipBtn: document.getElementById('skip-to-quiz-btn'),
        lessonTitle: document.getElementById('lesson-title'),
        lessonBody: document.getElementById('lesson-body'),
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
        
        // Interactive Elements
        questionContainer: document.getElementById('question-container'),
        interactiveContainer: document.getElementById('interactive-container'),
        interactiveInstruction: document.getElementById('interactive-instruction'),
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
    
    // Skip Handler
    if(elements.skipBtn) elements.skipBtn.addEventListener('click', handleSkipToQuiz);

    // Initial load: Do NOT force refresh, use cache if available.
    startLevel(false);
}

export function destroy() {
    clearInterval(timerInterval);
    if (typewriterInterval) clearInterval(typewriterInterval);
    stopLoadingAnimation();
    stopAudio();
    removeAntiCheat(); 
    if (outputAudioContext) {
        outputAudioContext.close().catch(e => console.error(e));
        outputAudioContext = null;
    }
    if (lessonAbortController) {
        lessonAbortController.abort();
    }
}
