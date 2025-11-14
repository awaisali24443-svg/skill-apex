import * as learningPathService from '../../services/learningPathService.js';
import * as apiService from '../../services/apiService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as markdownService from '../../services/markdownService.js';

let appState;
let path;

// DOM Elements
let elements = {};

// State for the active step modal
let stepSession = {
    isActive: false,
    isOverallTest: false,
    stepIndex: -1, // or testIndex
    stage: 'loading', // 'loading', 'learn', 'quiz', 'results'
    learningContent: null,
    quizQuestions: [],
    currentQuestionIndex: 0,
    score: 0,
};

// --- Main Rendering ---

function renderPath() {
    elements.goalTitle.textContent = path.goal;
    const completedSteps = path.path.length === path.currentStep ? path.currentStep : path.currentStep;
    elements.progressSummary.textContent = `Progress: ${completedSteps} / ${path.path.length} chapters completed`;
    
    elements.stepsList.innerHTML = '';
    let overallTestIndex = 1;

    path.path.forEach((step, index) => {
        // --- 1. RENDER THE REGULAR STEP ---
        const item = elements.stepItemTemplate.content.cloneNode(true);
        const card = item.querySelector('.step-item');
        const iconUse = item.querySelector('.step-icon use');
        item.querySelector('.step-name').textContent = step.name;
        const actionsContainer = item.querySelector('.step-actions');
        
        const score = path.stepScores ? path.stepScores[index] : null;

        // Determine step state
        const belongsToBlock = Math.floor(index / 10);
        const previousTestPassed = belongsToBlock === 0 || (path.overallTestScores?.[belongsToBlock] && (path.overallTestScores[belongsToBlock].score / path.overallTestScores[belongsToBlock].totalQuestions) >= 0.8);

        if (index < path.currentStep) {
            card.classList.add('completed');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#check-circle');
            if (score) {
                const scoreEl = item.querySelector('.step-score');
                scoreEl.textContent = `Score: ${score.score}/${score.totalQuestions}`;
                scoreEl.style.display = 'block';
            }
        } else if (index === path.currentStep && previousTestPassed) {
            card.classList.add('current');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#target');
            const startBtn = document.createElement('button');
            startBtn.className = 'btn btn-primary start-step-btn';
            startBtn.textContent = 'Start Chapter';
            startBtn.dataset.index = index;
            actionsContainer.appendChild(startBtn);
        } else {
            card.classList.add('locked');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#lock');
        }
        elements.stepsList.appendChild(item);

        // --- 2. RENDER OVERALL TEST (if applicable) ---
        if ((index + 1) % 10 === 0 && (index + 1) < path.path.length) {
            const testItem = elements.overallTestItemTemplate.content.cloneNode(true);
            const testCard = testItem.querySelector('.step-item');
            const testActions = testItem.querySelector('.step-actions');
            testItem.querySelector('.step-name').textContent = `Overall Test #${overallTestIndex} (Chapters ${index-8}-${index+1})`;

            // Determine test state
            const allPreviousStepsDone = path.currentStep >= (index + 1);
            const testScoreInfo = path.overallTestScores?.[overallTestIndex];
            const testPassed = testScoreInfo && (testScoreInfo.score / testScoreInfo.totalQuestions) >= 0.8;

            if (testPassed) {
                testCard.classList.add('completed');
                const scoreEl = testItem.querySelector('.step-score');
                scoreEl.textContent = `Score: ${testScoreInfo.score}/${testScoreInfo.totalQuestions}`;
                scoreEl.style.display = 'block';
            } else if (allPreviousStepsDone) {
                testCard.classList.add('current');
                const startTestBtn = document.createElement('button');
                startTestBtn.className = 'btn btn-primary start-overall-test-btn';
                startTestBtn.textContent = 'Start Test';
                startTestBtn.dataset.testIndex = overallTestIndex;
                startTestBtn.dataset.startIndex = index - 9;
                startTestBtn.dataset.endIndex = index;
                testActions.appendChild(startTestBtn);
            } else {
                testCard.classList.add('locked');
            }
            elements.stepsList.appendChild(testItem);
            overallTestIndex++;
        }
    });
}

// --- Step Session Modal Logic ---

function resetStepSession() {
    stepSession = {
        isActive: false, isOverallTest: false, stepIndex: -1, stage: 'loading',
        learningContent: null, quizQuestions: [], currentQuestionIndex: 0, score: 0
    };
}

function openModal(index, isTest, context = {}) {
    resetStepSession();
    stepSession.isActive = true;
    stepSession.isOverallTest = isTest;
    stepSession.stepIndex = index; // Represents chapter index or test index

    elements.modalContainer.innerHTML = elements.stepModalTemplate.innerHTML;
    elements.modalContainer.classList.add('visible');
    
    // Add event listeners for the newly created modal
    elements.modalContainer.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    elements.modalContainer.querySelector('.step-modal-close-btn').addEventListener('click', closeModal);
    
    if (isTest) {
        loadQuizStage(context);
    } else {
        loadLearnStage();
    }
}

function closeModal() {
    elements.modalContainer.classList.remove('visible');
    elements.modalContainer.innerHTML = '';
    resetStepSession();
}

function setModalContent(title, html) {
    const modalTitle = elements.modalContainer.querySelector('#step-modal-title');
    const modalBody = elements.modalContainer.querySelector('#step-modal-body');
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = html;
}

// --- Modal Stages ---

async function loadLearnStage() {
    stepSession.stage = 'loading';
    const step = path.path[stepSession.stepIndex];
    setModalContent(`Chapter ${stepSession.stepIndex + 1}: ${step.name}`, `
        <div class="modal-view-content loading">
            <p>The AI is preparing your lesson...</p>
            <div class="spinner"></div>
        </div>
    `);

    try {
        stepSession.learningContent = await apiService.generateLearningContent({ topic: step.topic });
        stepSession.stage = 'learn';
        const contentHtml = `
            <div class="modal-view-content learn-view">
                ${markdownService.render(stepSession.learningContent.summary)}
                <div class="learn-view-footer">
                    <button class="btn" id="ask-tutor-btn">
                        <svg class="icon"><use href="/assets/icons/feather-sprite.svg#mic"/></svg>
                        <span>Ask the Tutor</span>
                    </button>
                    <button class="btn btn-primary" id="ready-for-quiz-btn">I'm Ready for the Quiz!</button>
                </div>
            </div>
        `;
        setModalContent(stepSession.learningContent.title, contentHtml);
        elements.modalContainer.querySelector('#ready-for-quiz-btn').addEventListener('click', () => loadQuizStage());
        elements.modalContainer.querySelector('#ask-tutor-btn').addEventListener('click', () => {
            appState.context.auralContext = {
                from: `learning-path/${path.id}`,
                systemInstruction: `You are an expert AI tutor helping a user with the topic: "${step.name}". The user has just read a lesson about it. Be ready to answer specific questions they might have.`
            };
            window.location.hash = '/aural';
            closeModal();
        });

    } catch (error) {
        setModalContent('Error', `<p>Could not load learning content. Please try again.</p>`);
    }
}

async function loadQuizStage(context = {}) {
    stepSession.stage = 'loading';
    const title = stepSession.isOverallTest 
        ? `Overall Test #${stepSession.stepIndex}` 
        : `Quiz: ${path.path[stepSession.stepIndex].name}`;

    setModalContent(title, `
        <div class="modal-view-content loading">
            <p>The AI is crafting your questions...</p>
            <div class="spinner"></div>
        </div>
    `);

    try {
        let topic, numQuestions, difficulty, learningContext;
        if (stepSession.isOverallTest) {
            const relevantSteps = path.path.slice(context.startIndex, context.endIndex + 1);
            topic = `A test covering: ${relevantSteps.map(s => s.name).join(', ')}`;
            numQuestions = 15;
            difficulty = 'hard';
            learningContext = (await Promise.all(
                relevantSteps.map(step => apiService.generateLearningContent({ topic: step.topic }))
            )).map(content => content.summary).join(' ');
        } else {
            const step = path.path[stepSession.stepIndex];
            topic = step.topic;
            numQuestions = 5;
            difficulty = 'medium';
            learningContext = stepSession.learningContent.summary;
        }

        const quizData = await apiService.generateQuiz({ topic, numQuestions, difficulty, learningContext });
        stepSession.quizQuestions = quizData.questions;
        stepSession.stage = 'quiz';
        renderQuizQuestion();
    } catch (error) {
        setModalContent('Error', `<p>Could not generate the quiz. Please try again.</p>`);
    }
}

function renderQuizQuestion() {
    const question = stepSession.quizQuestions[stepSession.currentQuestionIndex];
    const questionHtml = `
        <div class="modal-view-content quiz-view">
            <h3 class="step-quiz-question">${stepSession.currentQuestionIndex + 1}. ${question.question}</h3>
            <div class="step-quiz-options">
                ${question.options.map((opt, i) => `<button class="btn step-quiz-option-btn" data-index="${i}">${opt}</button>`).join('')}
            </div>
            <div class="step-quiz-feedback" style="display: none;"></div>
        </div>
    `;
    setModalContent(`Question ${stepSession.currentQuestionIndex + 1} of ${stepSession.quizQuestions.length}`, questionHtml);
    elements.modalContainer.querySelector('.step-quiz-options').addEventListener('click', handleQuizAnswer);
}

function handleQuizAnswer(event) {
    const button = event.target.closest('.step-quiz-option-btn');
    if (!button || button.disabled) return;

    const selectedIndex = parseInt(button.dataset.index, 10);
    const question = stepSession.quizQuestions[stepSession.currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswerIndex;

    if (isCorrect) stepSession.score++;

    const optionButtons = elements.modalContainer.querySelectorAll('.step-quiz-option-btn');
    optionButtons.forEach(btn => {
        const index = parseInt(btn.dataset.index, 10);
        if (index === question.correctAnswerIndex) btn.classList.add('correct');
        else if (index === selectedIndex) btn.classList.add('incorrect');
        btn.disabled = true;
    });

    const feedbackContainer = elements.modalContainer.querySelector('.step-quiz-feedback');
    const isLastQuestion = stepSession.currentQuestionIndex === stepSession.quizQuestions.length - 1;
    feedbackContainer.innerHTML = `
        <p>${question.explanation}</p>
        <button class="btn btn-primary" id="next-quiz-btn">${isLastQuestion ? 'Finish' : 'Next Question'}</button>
    `;
    feedbackContainer.style.display = 'block';
    elements.modalContainer.querySelector('#next-quiz-btn').addEventListener('click', () => {
        if (isLastQuestion) {
            loadResultsStage();
        } else {
            stepSession.currentQuestionIndex++;
            renderQuizQuestion();
        }
    });
}

function loadResultsStage() {
    stepSession.stage = 'results';
    const passThreshold = stepSession.isOverallTest ? 0.8 : 0.8; // 80% for both
    const scoreRatio = stepSession.score / stepSession.quizQuestions.length;
    const hasPassed = scoreRatio >= passThreshold;
    
    let resultsHtml = `
        <div class="modal-view-content step-results-view">
            <h3>${hasPassed ? 'Passed!' : 'Keep Trying!'}</h3>
            <p>You answered ${stepSession.score} out of ${stepSession.quizQuestions.length} questions correctly.</p>
            ${!hasPassed && stepSession.isOverallTest ? '<p>You must score at least 80% to unlock the next chapters.</p>' : ''}
            <div class="btn-group">
                ${hasPassed 
                    ? `<button class="btn btn-primary" id="complete-step-btn">Continue</button>`
                    : `<button class="btn" id="retry-step-btn">Try Again</button>
                       <button class="btn" id="return-to-path-btn">Return to Path</button>`
                }
            </div>
        </div>
    `;
    setModalContent('Results', resultsHtml);
    
    if(hasPassed) {
        if (stepSession.isOverallTest) {
            learningPathService.recordOverallTestScore(path.id, stepSession.stepIndex, stepSession.score, stepSession.quizQuestions.length);
        } else {
            learningPathService.recordStepScore(path.id, stepSession.stepIndex, stepSession.score, stepSession.quizQuestions.length);
        }
        elements.modalContainer.querySelector('#complete-step-btn').addEventListener('click', () => {
            if (!stepSession.isOverallTest) {
                learningPathService.completeStep(path.id);
            }
            closeModal();
            path = learningPathService.getPathById(path.id);
            renderPath();
        });
    } else {
        elements.modalContainer.querySelector('#retry-step-btn').addEventListener('click', () => {
            if (stepSession.isOverallTest) {
                 const btn = document.querySelector(`.start-overall-test-btn[data-test-index='${stepSession.stepIndex}']`);
                 openModal(stepSession.stepIndex, true, { startIndex: parseInt(btn.dataset.startIndex), endIndex: parseInt(btn.dataset.endIndex) });
            } else {
                 openModal(stepSession.stepIndex, false);
            }
        });
        elements.modalContainer.querySelector('#return-to-path-btn').addEventListener('click', closeModal);
    }
}

// --- Event Handlers & Init ---

async function handleDeletePath() {
    const confirmed = await showConfirmationModal({
        title: 'Delete Learning Path',
        message: `Are you sure you want to permanently delete the path for "${path.goal}"? This action cannot be undone.`,
        confirmText: 'Yes, Delete Path'
    });
    if (confirmed) {
        learningPathService.deletePath(path.id);
        window.location.hash = '/profile';
    }
}

function handleClick(event) {
    const stepBtn = event.target.closest('.start-step-btn');
    if (stepBtn) {
        const stepIndex = parseInt(stepBtn.dataset.index, 10);
        openModal(stepIndex, false);
    }

    const testBtn = event.target.closest('.start-overall-test-btn');
    if (testBtn) {
        const testIndex = parseInt(testBtn.dataset.testIndex, 10);
        openModal(testIndex, true, { 
            startIndex: parseInt(testBtn.dataset.startIndex), 
            endIndex: parseInt(testBtn.dataset.endIndex) 
        });
    }
}

export function init(globalState) {
    appState = globalState;
    const pathId = appState.context.params.id;
    path = learningPathService.getPathById(pathId);

    if (!path) {
        window.location.hash = '/topics';
        return;
    }

    elements = {
        goalTitle: document.getElementById('path-goal-title'),
        progressSummary: document.getElementById('path-progress-summary'),
        stepsList: document.getElementById('path-steps-list'),
        deleteBtn: document.getElementById('delete-path-btn'),
        stepItemTemplate: document.getElementById('step-item-template'),
        overallTestItemTemplate: document.getElementById('overall-test-item-template'),
        modalContainer: document.getElementById('step-modal-container'),
        stepModalTemplate: document.getElementById('step-modal-template').content,
    };

    renderPath();

    elements.stepsList.addEventListener('click', handleClick);
    elements.deleteBtn.addEventListener('click', handleDeletePath);
}

export function destroy() {
    if (stepSession.isActive) {
        closeModal();
    }
    if (elements.stepsList) {
       elements.stepsList.removeEventListener('click', handleClick);
    }
    if (elements.deleteBtn) {
        elements.deleteBtn.removeEventListener('click', handleDeletePath);
    }
}