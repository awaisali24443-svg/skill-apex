import * as learningPathService from '../../services/learningPathService.js';
import { showConfirmationModal } from '../../services/modalService.js';
import * as apiService from '../../services/apiService.js';
import * as markdownService from '../../services/markdownService.js';

let appState;
let path;
let elements;
let currentModalStepIndex = null;
let synthesisContent = null;
let audioContext, audioBuffer, audioSourceNode;

// --- Audio Decoding ---
function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
async function decodeAudioData(data, ctx) {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / 1; // Assuming mono channel
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}


function startSocraticTest(index) {
    if (index < 0 || index >= path.path.length || !synthesisContent) return;
    closeModal();
    const step = path.path[index];
    appState.context.socraticContext = {
        topic: step.topic,
        summary: synthesisContent.summary,
        learningPathId: path.id,
        learningPathStepIndex: index
    };
    window.location.hash = '/socratic';
}

function startKnowledgeCheck(index) {
    if (index < 0 || index >= path.path.length || !synthesisContent) return;
    closeModal();
    const step = path.path[index];
    appState.context = {
        topic: step.topic,
        numQuestions: 5,
        difficulty: 'medium',
        learningContext: synthesisContent.summary, // Base quiz on the summary
        learningPathId: path.id,
        learningPathStepIndex: index,
    };
    window.location.hash = '/loading';
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

function renderMindMap(node) {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = node.name;
    span.className = 'mind-map-node';
    li.appendChild(span);
    
    if (node.children && node.children.length > 0) {
        const childrenUl = document.createElement('ul');
        node.children.forEach(child => {
            const childLi = renderMindMap(child).querySelector('li');
            childrenUl.appendChild(childLi);
        });
        li.appendChild(childrenUl);
    }
    ul.appendChild(li);
    return ul;
}

async function playAudio() {
    if (!audioBuffer) return;
    if (audioSourceNode) { // If it's already playing, stop it
        audioSourceNode.stop();
        audioSourceNode = null;
        elements.playAudioBtn.classList.remove('playing');
        return;
    }
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    
    audioSourceNode = audioContext.createBufferSource();
    audioSourceNode.buffer = audioBuffer;
    audioSourceNode.connect(audioContext.destination);
    audioSourceNode.start(0);

    elements.playAudioBtn.classList.add('playing');
    audioSourceNode.onended = () => {
        elements.playAudioBtn.classList.remove('playing');
        audioSourceNode = null;
    };
}


async function openLevelModal(index) {
    const currentModalStep = path.path[index];
    currentModalStepIndex = index;
    if (!currentModalStep) return;

    elements.modal.style.display = 'flex';
    elements.modalTitle.textContent = `Level ${index + 1}`;
    elements.modalSubtitle.textContent = currentModalStep.name;
    elements.modalLoadingState.style.display = 'block';
    elements.modalBody.style.display = 'none';
    elements.modalFooter.innerHTML = '';
    elements.playAudioBtn.disabled = true;
    
    synthesisContent = null;
    audioBuffer = null;

    try {
        synthesisContent = await apiService.generateSynthesis({ topic: currentModalStep.topic });

        try {
            const speechResult = await apiService.generateSpeech({ text: synthesisContent.title });
            const audioData = speechResult.audioData;
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            audioBuffer = await decodeAudioData(decode(audioData), audioContext);
            elements.playAudioBtn.disabled = false;
        } catch (speechError) {
            console.warn('Speech generation failed, but content is loaded:', speechError);
        }

        elements.summaryPanel.innerHTML = markdownService.render(synthesisContent.summary);
        const mindMapEl = renderMindMap(synthesisContent.mind_map.root);
        mindMapEl.querySelector('.mind-map-node').classList.add('mind-map-root');
        elements.mindmapPanel.innerHTML = '';
        elements.mindmapPanel.appendChild(mindMapEl);
        elements.analogiesPanel.innerHTML = synthesisContent.analogies.map(a => 
            `<div class="analogy-card"><p>"${a}"</p></div>`
        ).join('');

    } catch (synthesisError) {
        console.error("Synthesis generation failed:", synthesisError);
        elements.summaryPanel.innerHTML = '<p class="error">Error loading content. Please try again.</p>';
    } finally {
        elements.modalLoadingState.style.display = 'none';
        elements.modalBody.style.display = 'block';

        elements.modalFooter.innerHTML = `
            <button class="btn" id="modal-socratic-btn">
                 <svg class="icon"><use href="/assets/icons/feather-sprite.svg#message-circle"/></svg>
                <span>Socratic Gauntlet</span>
            </button>
            <button class="btn btn-primary" id="modal-quiz-btn">
                 <svg class="icon"><use href="/assets/icons/feather-sprite.svg#zap"/></svg>
                <span>Knowledge Check</span>
            </button>
        `;
        document.getElementById('modal-socratic-btn').onclick = () => startSocraticTest(index);
        document.getElementById('modal-quiz-btn').onclick = () => startKnowledgeCheck(index);
    }
}


function closeModal() {
    elements.modal.style.display = 'none';
    currentModalStepIndex = null;
    synthesisContent = null;
    if (audioSourceNode) {
        audioSourceNode.stop();
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
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

function handleTabClick(event) {
    const clickedTab = event.target.closest('button[role="tab"]');
    if (!clickedTab) return;

    elements.tabs.forEach(tab => { 
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    clickedTab.classList.add('active');
    clickedTab.setAttribute('aria-selected', 'true');

    elements.panels.forEach(panel => {
        if (panel.id === clickedTab.getAttribute('aria-controls')) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });
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
        modalSubtitle: document.getElementById('modal-subtitle'),
        modalLoadingState: document.getElementById('modal-loading-state'),
        modalBody: document.getElementById('modal-body'),
        modalFooter: document.getElementById('modal-footer'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        tabContainer: document.getElementById('synthesis-tabs'),
        playAudioBtn: document.getElementById('play-audio-btn'),
        summaryPanel: document.getElementById('panel-summary'),
        mindmapPanel: document.getElementById('panel-mindmap'),
        analogiesPanel: document.getElementById('panel-analogies'),
        tabs: document.querySelectorAll('#synthesis-tabs button'),
        panels: document.querySelectorAll('.tab-panels [role="tabpanel"]'),
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
    elements.tabContainer.addEventListener('click', handleTabClick);
    elements.playAudioBtn.addEventListener('click', playAudio);
}

export function destroy() {
    closeModal();
    if (appState && appState.context.socraticContext) {
        delete appState.context.socraticContext;
    }
}