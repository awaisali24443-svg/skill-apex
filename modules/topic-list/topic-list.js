

import * as apiService from '../../services/apiService.js';
import * as stateService from '../../services/stateService.js';

let topicGrid, template;

// --- UI Rendering & Event Listeners ---

function renderTopics(topics) {
    topicGrid.innerHTML = '';
    
    if (!topics || topics.length === 0) {
        topicGrid.innerHTML = `<p>No topics available at the moment. Please try again later.</p>`;
        return;
    }

    topics.forEach((topic, index) => {
        const card = template.content.cloneNode(true);
        const cardEl = card.querySelector('.topic-card');
        cardEl.dataset.topic = topic.name;
        cardEl.classList.add(topic.styleClass);
        cardEl.style.animationDelay = `${index * 30}ms`;
        
        card.querySelector('.topic-name').textContent = topic.name;
        card.querySelector('.topic-description').textContent = topic.description;
        
        topicGrid.appendChild(card);
    });
}

function handleGridInteraction(event) {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    
    const card = event.target.closest('.topic-card');
    if (!card) return;

    event.preventDefault();
    const topic = card.dataset.topic;
    
    // Set context and navigate to the game map for the selected topic
    stateService.setNavigationContext({ topic });
    window.location.hash = `#/game/${encodeURIComponent(topic)}`;
}

export async function init() {
    topicGrid = document.getElementById('topic-grid-container');
    template = document.getElementById('topic-card-template');

    topicGrid.addEventListener('click', handleGridInteraction);
    topicGrid.addEventListener('keydown', handleGridInteraction);
    
    try {
        // Fetch topics directly from the API instead of using a pre-built search index
        const allTopics = await apiService.fetchTopics();
        renderTopics(allTopics);
    } catch (error) {
        topicGrid.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
    }
}

export function destroy() {
    // DOM elements are removed, so event listeners on them are automatically cleaned up.
}
