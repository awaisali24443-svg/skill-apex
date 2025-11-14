import * as apiService from '../../services/apiService.js';
import * as searchService from '../../services/searchService.js';
import * as learningPathService from '../../services/learningPathService.js';
import { showToast } from '../../services/toastService.js';

let appState;
let searchInput, topicGrid, customTopicContainer, template;
let elements = {};
let activeTopic = null;

// --- Action Handlers ---

function startQuickQuiz() {
    if (!activeTopic) return;

    appState.context = {
        topic: activeTopic.name,
        numQuestions: 10,
        difficulty: 'medium',
    };
    window.location.hash = '/loading';
    closeModal();
}

async function startJourney(forceCreate = false) {
    if (!activeTopic) return;
    closeModal();
    showToast(`Checking for journey: "${activeTopic.name}"...`, 'info');

    if (!forceCreate) {
        let path = learningPathService.getPathByGoal(activeTopic.name);
        if (path) {
            window.location.hash = `#/learning-path/${path.id}`;
            return;
        }
    }

    showToast(`Generating a new learning journey...`);
    try {
        const result = await apiService.generateLearningPath({ goal: activeTopic.name });
        if (result && result.path) {
            const newPath = learningPathService.addPath(activeTopic.name, result.path);
            window.location.hash = `#/learning-path/${newPath.id}`;
        } else {
            throw new Error("The AI failed to generate a valid path. Please try a different topic.");
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// --- Modal Logic ---

function openModal(topic, isCustom) {
    activeTopic = { name: topic }; // Stash the topic for modal actions
    elements.modal.style.display = 'flex';
    elements.modalTopicTitle.textContent = topic;

    // Remove old listeners and add new ones to prevent multiple triggers
    const newJourneyBtn = elements.startJourneyBtn.cloneNode(true);
    elements.startJourneyBtn.parentNode.replaceChild(newJourneyBtn, elements.startJourneyBtn);
    elements.startJourneyBtn = newJourneyBtn;

    const newQuizBtn = elements.startQuizBtn.cloneNode(true);
    elements.startQuizBtn.parentNode.replaceChild(newQuizBtn, elements.startQuizBtn);
    elements.startQuizBtn = newQuizBtn;

    elements.startJourneyBtn.addEventListener('click', () => startJourney(isCustom));
    elements.startQuizBtn.addEventListener('click', startQuickQuiz);
}

function closeModal() {
    elements.modal.style.display = 'none';
    activeTopic = null;
}

// --- UI Rendering & Event Listeners ---

function renderTopics(topics, query = '') {
    topicGrid.innerHTML = '';
    customTopicContainer.innerHTML = '';
    
    if (topics.length === 0 && query) {
        customTopicContainer.innerHTML = `
            <div class="card topic-card custom-generator-card" data-topic="${query}" tabindex="0" role="button">
                <div class="card-content">
                    <h3>Create content for "${query}"</h3>
                    <p>The AI can build a journey or a quiz for any topic you can imagine.</p>
                </div>
            </div>
        `;
        return;
    }

    topics.forEach((topic, index) => {
        const card = template.content.cloneNode(true);
        const cardEl = card.querySelector('.topic-card');
        cardEl.dataset.topic = topic.name;
        cardEl.style.animationDelay = `${index * 20}ms`;
        
        card.querySelector('.topic-name').textContent = topic.name;
        card.querySelector('.category-tag').textContent = topic.category;
        card.querySelector('.difficulty-tag').textContent = topic.difficulty;
        
        topicGrid.appendChild(card);
    });
}

function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    const originalQuery = searchInput.value.trim();
    const allTopics = searchService.getIndex();

    if (!query) {
        renderTopics(allTopics);
        return;
    }
    const filteredTopics = allTopics.filter(topic =>
        topic.name.toLowerCase().includes(query) ||
        topic.category.toLowerCase().includes(query)
    );
    renderTopics(filteredTopics, originalQuery);
}

function handleGridInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();

    const card = event.target.closest('.topic-card');
    if (!card) return;
    
    const topic = card.dataset.topic;
    const isCustom = card.classList.contains('custom-generator-card');
    openModal(topic, isCustom);
}


export async function init(globalState) {
    appState = globalState;
    searchInput = document.getElementById('search-input');
    topicGrid = document.getElementById('topic-grid-container');
    customTopicContainer = document.getElementById('custom-topic-container');
    template = document.getElementById('topic-card-template');

    elements = {
        modal: document.getElementById('action-modal'),
        modalBackdrop: document.querySelector('.modal-backdrop'),
        modalTopicTitle: document.getElementById('modal-topic-title'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        startJourneyBtn: document.getElementById('start-journey-btn'),
        startQuizBtn: document.getElementById('start-quiz-btn'),
    };

    searchInput.addEventListener('input', handleSearch);
    topicGrid.addEventListener('click', handleGridInteraction);
    topicGrid.addEventListener('keydown', handleGridInteraction);
    customTopicContainer.addEventListener('click', handleGridInteraction);
    customTopicContainer.addEventListener('keydown', handleGridInteraction);
    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalBackdrop.addEventListener('click', closeModal);

    try {
        const allTopics = searchService.getIndex();
        renderTopics(allTopics);
    } catch (error) {
        topicGrid.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
    }
}

export function destroy() {
    // DOM elements are removed, so event listeners on them are automatically cleaned up.
}