import * as searchService from '../../services/searchService.js';
import { initializeCardGlow } from '../../global/global.js';

let appState;
let searchInput;
let resultsContainer;
let template;

function renderResults(topics) {
    resultsContainer.innerHTML = '';
    if (!topics.length && searchInput.value) {
        resultsContainer.innerHTML = `<p class="no-results" style="grid-column: 1 / -1; text-align: center;">No topics found. Try a different search term.</p>`;
        return;
    }

    topics.forEach(topic => {
        const card = template.content.cloneNode(true);
        card.querySelector('.category-tag').textContent = topic.category;
        card.querySelector('.difficulty-tag').textContent = topic.difficulty;
        card.querySelector('.topic-name').textContent = topic.name;
        
        const button = card.querySelector('.start-quiz-btn');
        button.dataset.topic = topic.name;
        button.dataset.difficulty = topic.difficulty;

        resultsContainer.appendChild(card);
    });
    initializeCardGlow(resultsContainer);
}


function handleSearch() {
    const query = searchInput.value;
    if (query.length > 2) {
        const results = searchService.search(query);
        renderResults(results);
    } else if (query.length === 0) {
        // Show some default/popular topics when search is cleared
        renderResults(searchService.getIndex().slice(0, 8));
    }
}

function handleResultClick(event) {
    const button = event.target.closest('.start-quiz-btn');
    if (button) {
        appState.context = {
            topic: button.dataset.topic,
            numQuestions: 10,
            difficulty: button.dataset.difficulty
        };
        window.location.hash = '/loading';
    }
}

export function init(globalState) {
    appState = globalState;
    searchInput = document.getElementById('search-input');
    resultsContainer = document.getElementById('search-results-container');
    template = document.getElementById('search-result-template');

    searchInput.addEventListener('input', handleSearch);
    resultsContainer.addEventListener('click', handleResultClick);
    
    // Initial render with some default topics
    renderResults(searchService.getIndex().slice(0, 8));
    searchInput.focus();
}

export function destroy() {
    searchInput.removeEventListener('input', handleSearch);
    resultsContainer.removeEventListener('click', handleResultClick);
}
