

import { getCategories } from '../../services/topicService.js';
import { search } from '../../services/searchService.js';
import { initializeCardGlow } from '../../global/global.js';

let resultsContainer;
let searchInput;
let appStateRef;

function renderCategories(categories) {
    if (categories.length > 0) {
        resultsContainer.innerHTML = categories.map(category => `
            <a href="${category.href || `/#topics/${category.id}`}" class="category-card">
                <div>
                    <div class="card-header">
                        <div class="card-icon">${category.icon}</div>
                        <div class="card-title">
                            <h3>${category.name}</h3>
                        </div>
                    </div>
                    <p class="card-description">${category.description}</p>
                </div>
                <div class="card-footer">
                    <span>View Topics →</span>
                </div>
            </a>
        `).join('');
    } else {
        resultsContainer.innerHTML = '<p class="no-results-message">No categories available at the moment.</p>';
    }
    initializeCardGlow(); // Apply effect to newly rendered cards
}

function renderSearchResults(results, query) {
    if (results.length > 0) {
        resultsContainer.innerHTML = results.map(item => {
            if (item.type === 'category') {
                return `
                    <a href="${item.href}" class="category-card">
                        <div>
                            <div class="card-header">
                                <div class="card-icon">${item.icon}</div>
                                <div class="card-title"><h3>${item.name}</h3></div>
                            </div>
                            <p class="card-description">${item.description}</p>
                        </div>
                        <div class="card-footer"><span>View Topics →</span></div>
                    </a>
                `;
            } else { // topic
                return `
                    <a href="${item.href}" class="topic-result-card" data-topic-name="${item.name}" data-topic-id="${item.id}">
                        <div class="card-icon">${item.icon}</div>
                        <div class="card-title"><h4>${item.name}</h4></div>
                    </a>
                `;
            }
        }).join('');
    } else {
        resultsContainer.innerHTML = `<p class="no-results-message">No results found for "${query}"</p>`;
    }
    initializeCardGlow(); // Apply effect to newly rendered cards
}

async function showDefaultView() {
    try {
        const categories = await getCategories();
        renderCategories(categories);
    } catch (error) {
        console.error("Failed to load categories:", error);
        resultsContainer.innerHTML = '<p class="no-results-message">Could not load categories. Please try again later.</p>';
    }
}

const handleSearchInput = (e) => {
    const query = e.target.value;
    if (query.trim().length > 0) {
        const results = search(query);
        renderSearchResults(results, query);
    } else {
        showDefaultView();
    }
};

const handleResultClick = (e) => {
    const link = e.target.closest('a[data-topic-name]');
    if (!link) return;

    e.preventDefault();
    const topicName = link.dataset.topicName;
    const topicId = link.dataset.topicId;
    
    if (appStateRef) {
        appStateRef.context = { topic: topicName, topicId: topicId };
    }
    
    window.location.hash = '#loading';
};

export async function init(appState) {
    appStateRef = appState;
    resultsContainer = document.getElementById('explore-results-container');
    searchInput = document.getElementById('explore-search-input');
    
    if (!resultsContainer || !searchInput) return;

    await showDefaultView();

    searchInput.addEventListener('input', handleSearchInput);
    resultsContainer.addEventListener('click', handleResultClick);
}

export function destroy() {
    if (searchInput) {
        searchInput.removeEventListener('input', handleSearchInput);
    }
    if (resultsContainer) {
        resultsContainer.removeEventListener('click', handleResultClick);
    }
    appStateRef = null;
    console.log("Explore Topics module destroyed.");
}