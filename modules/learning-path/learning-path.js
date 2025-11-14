import * as learningPathService from '../../services/learningPathService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as apiService from '../../services/apiService.js';
import * as markdownService from '../../services/markdownService.js';

let appState;
let path;
let elements;
let currentModalStep = null;

function startQuiz(index, learningContext = null) {
    if (index < 0 || index >= path.path.length) return;

    const step = path.path[index];
    appState.context = {
        topic: step.topic,
        numQuestions: 5,
        difficulty: 'medium',
        learningPathId: path.id,
        learningPathStepIndex: index,
        learningContext: learningContext
    };
    window.location.hash = '/loading';
}

function startAuralTutor(index) {
    if (index < 0 || index >= path.path.length) return;
    const step = path.path[index];
    
    // Set a context for the Aural module
    appState.context.auralContext = {
        systemInstruction: `You are a friendly and knowledgeable tutor specializing in "${step.name}". Your goal is to help the user understand this topic through a conversation. Keep your explanations clear and simple. Start by saying hello and asking what they'd like to know about "${step.name}".`,
        from: `learning-path/${path.id}` // Where to return to
    };

    window.location.hash = '/aural';
}


function render() {
    if (!path) return;
    const { currentStep, goal, path: steps } = path;
    const totalSteps = steps.length;
    const isCompleted = currentStep >= totalSteps;

    elements.goalTitle.textContent = goal;
    elements.progressText.textContent = isCompleted 
        ? `Journey Complete! (${totalSteps} / ${totalSteps})`
        : `Level ${currentStep + 1} of ${totalSteps}`;
    const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
    elements.progressBarFill.style.width = `${progressPercent}%`;

    elements.levelsGrid.innerHTML = '';
    const template = elements.levelCardTemplate.content;
    
    steps.forEach((step, index) => {
        const card = template.cloneNode(true);
        const cardEl = card.querySelector('.level-card');
        cardEl.dataset.index = index;
        cardEl.style.animationDelay = `${index * 30}ms`;

        cardEl.querySelector('.level-number').textContent = `Level ${index + 1}`;
        cardEl.querySelector('.level-name').textContent = step.name;
        
        const iconUse = cardEl.querySelector('.level-icon use');

        if (index < currentStep) {
            cardEl.classList.add('completed');
            cardEl.querySelector('.level-status').textContent = 'Done';
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#check-circle');
        } else if (index === currentStep) {
            cardEl.classList.add('available');
            cardEl.querySelector('.level-status').textContent = 'Next';
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#play');
        } else {
            cardEl.classList.add('locked');
            cardEl.querySelector('.level-status').textContent = 'Locked';
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#lock');
        }
        elements.levelsGrid.appendChild(card);
    });

    if (isCompleted) {
        elements.startLevelBtnText.textContent = 'Journey Complete';
        elements.startLevelBtn.disabled = true;
    } else {
        elements.startLevelBtnText.textContent = `Start Level ${currentStep + 1}`;
        elements.startLevelBtn.disabled = false;
        elements.startLevelBtn.dataset.index = currentStep;
    }
}

async function openLevelModal(index) {
    currentModalStep = path.path[index];
    if (!currentModalStep) return;

    elements.modal.style.display = 'flex';
    elements.modalTitle.textContent = `Level ${index + 1}: ${currentModalStep.name}`;
    elements.modalBody.innerHTML = '';
    elements.modalFooter.innerHTML = '';

    const isCompleted = index < path.currentStep;
    const quizButtonText = isCompleted ? 'Retake Quiz' : 'Start Quiz';
    const learnButtonText = isCompleted ? 'Review Summary' : 'Read Summary';

    elements.modalFooter.innerHTML = `
        <button class="btn" id="modal-learn-btn">
            <svg class="icon"><use href="assets/icons/feather-sprite.svg#book-open"/></svg>
            <span>${learnButtonText}</span>
        </button>
        <button class="btn" id="modal-tutor-btn">
            <svg class="icon"><use href="assets/icons/feather-sprite.svg#mic"/></svg>
            <span>Talk to Tutor</span>
        </button>
        <button class="btn btn-primary" id="modal-quiz-btn">
             <svg class="icon"><use href="assets/icons/feather-sprite.svg#play"/></svg>
            <span>${quizButtonText}</span>
        </button>
    `;
    
    document.getElementById('modal-learn-btn').onclick = handleLearn;
    document.getElementById('modal-tutor-btn').onclick = () => startAuralTutor(index);
    document.getElementById('modal-quiz-btn').onclick = () => startQuiz(index);
}

async function handleLearn() {
    elements.modalBody.innerHTML = `
        <div id="modal-image-container" class="modal-image-container loading"></div>
        <div id="modal-text-content">
            <div class="spinner"></div>
            <p>Generating learning material...</p>
        </div>
    `;
    elements.modalFooter.innerHTML = '';

    const modalImageContainer = document.getElementById('modal-image-container');
    const modalTextContent = document.getElementById('modal-text-content');
    
    const [imageResult, contentResult] = await Promise.allSettled([
        apiService.generateImage({ topic: currentModalStep.topic }),
        apiService.generateLearningContent({ topic: currentModalStep.topic })
    ]);

    if (imageResult.status === 'fulfilled' && imageResult.value.imageData) {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${imageResult.value.imageData}`;
        img.alt = `AI-generated illustration for ${currentModalStep.topic}`;
        modalImageContainer.innerHTML = '';
        modalImageContainer.appendChild(img);
    } else {
        if (imageResult.status === 'rejected') console.warn("Could not generate image, proceeding without it.", imageResult.reason);
        modalImageContainer.style.display = 'none';
    }
    modalImageContainer.classList.remove('loading');

    if (contentResult.status === 'fulfilled') {
        const summaryText = contentResult.value.summary;
        modalTextContent.innerHTML = markdownService.render(summaryText);
        elements.modalFooter.innerHTML = `
            <button class="btn btn-primary" id="modal-quiz-btn">Start Quiz</button>
        `;
        const index = path.path.findIndex(step => step.name === currentModalStep.name);
        document.getElementById('modal-quiz-btn').onclick = () => startQuiz(index, summaryText);
    } else {
        modalTextContent.innerHTML = `<p>Error generating content. Please try again.</p>`;
        modalImageContainer.style.display = 'none';
        elements.modalFooter.innerHTML = `<button class="btn" id="modal-close-btn-footer">Close</button>`;
        document.getElementById('modal-close-btn-footer').onclick = closeModal;
    }
}

function closeModal() {
    elements.modal.style.display = 'none';
    currentModalStep = null;
}

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

function handleGridClick(event) {
    const card = event.target.closest('.level-card');
    if (card && !card.classList.contains('locked')) {
        const index = parseInt(card.dataset.index, 10);
        openLevelModal(index);
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
        progressText: document.getElementById('progress-text'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        levelsGrid: document.getElementById('levels-grid'),
        backBtn: document.getElementById('back-btn'),
        startLevelBtn: document.getElementById('start-level-btn'),
        startLevelBtnText: document.getElementById('start-level-btn-text'),
        deleteBtn: document.getElementById('delete-path-btn'),
        levelCardTemplate: document.getElementById('level-card-template'),
        modal: document.getElementById('level-modal'),
        modalBackdrop: document.getElementById('modal-backdrop'),
        modalTitle: document.getElementById('modal-title'),
        modalBody: document.getElementById('modal-body'),
        modalFooter: document.getElementById('modal-footer'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
    };

    render();

    elements.levelsGrid.addEventListener('click', handleGridClick);
    elements.startLevelBtn.addEventListener('click', () => {
        if (!elements.startLevelBtn.disabled) {
            const index = parseInt(elements.startLevelBtn.dataset.index, 10);
            openLevelModal(index);
        }
    });
    elements.backBtn.addEventListener('click', () => window.location.hash = '/topics');
    elements.deleteBtn.addEventListener('click', handleDeletePath);
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalBackdrop.addEventListener('click', closeModal);
}

export function destroy() {
    // DOM is destroyed, so no need to remove listeners
    if (appState && appState.context.auralContext) {
        delete appState.context.auralContext;
    }
}