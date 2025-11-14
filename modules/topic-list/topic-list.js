import * as apiService from '../../services/apiService.js';
import * as searchService from '../../services/searchService.js';
import * as learningPathService from '../../services/learningPathService.js';
import { showToast } from '../../services/toastService.js';

let appState;
let searchInput, topicGrid, customTopicContainer, template;
let allTopics = [];

async function startJourney(topic, forceCreate = false) {
    // A simple loading state by disabling the search bar
    searchInput.disabled = true;
    
    if (!forceCreate) {
        showToast(`Checking for journey: "${topic}"...`, 'info');
        let path = learningPathService.getPathByGoal(topic);
        if (path) {
            window.location.hash = `#/learning-path/${path.id}`;
            return; // No need to re-enable searchInput, as we are navigating away
        }
    }

    showToast(`Generating a new learning journey for "${topic}"...`);
    try {
        const result = await apiService.generateLearningPath({ goal: topic });
        if (result && result.path) {
            const newPath = learningPathService.addPath(topic, result.path);
            window.location.hash = `#/learning-path/${newPath.id}`;
        } else {
            throw new Error("The AI failed to generate a valid path. Please try a different topic.");
        }
    } catch (error) {
        showToast(error.message, 'error');
        searchInput.disabled = false; // Re-enable on failure
    }
}

function renderTopics(topics, query = '') {
    topicGrid.innerHTML = '';
    customTopicContainer.innerHTML = '';
    
    if (topics.length === 0 && query) {
        customTopicContainer.innerHTML = `
            <div class="card topic-card custom-generator-card" data-topic="${query}" tabindex="0" role="button">
                <div class="card-content">
                    <h3>Create a Journey for "${query}"</h3>
                    <p>The AI will build a brand new, step-by-step path for this topic.</p>
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

async function handleGridClick(event) {
    const card = event.target.closest('.topic-card');
    if (!card) return;
    const topic = card.dataset.topic;
    const isCustom = card.classList.contains('custom-generator-card');
    await startJourney(topic, isCustom);
}

async function handleGridKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        const card = event.target.closest('.topic-card');
        if (!card) return;
        event.preventDefault(); // Prevent space from scrolling
        const topic = card.dataset.topic;
        const isCustom = card.classList.contains('custom-generator-card');
        await startJourney(topic, isCustom);
    }
}

export async function init(globalState) {
    appState = globalState;
    searchInput = document.getElementById('search-input');
    topicGrid = document.getElementById('topic-grid-container');
    customTopicContainer = document.getElementById('custom-topic-container');
    template = document.getElementById('topic-card-template');

    searchInput.addEventListener('input', handleSearch);
    topicGrid.addEventListener('click', handleGridClick);
    topicGrid.addEventListener('keydown', handleGridKeydown);
    customTopicContainer.addEventListener('click', handleGridClick);
    customTopicContainer.addEventListener('keydown', handleGridKeydown);

    try {
        allTopics = searchService.getIndex();
        renderTopics(allTopics);
    } catch (error) {
        topicGrid.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
    }
}

export function destroy() {
    if (searchInput) searchInput.removeEventListener('input', handleSearch);
    if (topicGrid) {
        topicGrid.removeEventListener('click', handleGridClick);
        topicGrid.removeEventListener('keydown', handleGridKeydown);
    }
    if (customTopicContainer) {
        customTopicContainer.removeEventListener('click', handleGridClick);
        customTopicContainer.removeEventListener('keydown', handleGridKeydown);
    }
}