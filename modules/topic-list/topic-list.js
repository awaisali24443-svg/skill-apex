


import { getTopicsForCategory, getCategoryById } from '../../services/topicService.js';
import { initializeCardGlow } from '../../global/global.js';

let listContainer;
let appStateRef;

const handleTopicClick = (e) => {
    const link = e.target.closest('.topic-item-link');
    if (!link) return;

    e.preventDefault();
    const topicName = link.dataset.topicName;
    const topicId = link.dataset.topicId;
    
    // Use the stored appState reference to modify the context
    if (appStateRef) {
        appStateRef.context = { topic: topicName, topicId: topicId };
    }
    
    window.location.hash = '#loading';
};

export async function init(appState) {
    appStateRef = appState; // Store reference to appState
    listContainer = document.getElementById('topic-list-container');
    const categoryTitle = document.getElementById('category-title');
    const categoryDescription = document.getElementById('category-description');
    
    const categoryId = appState.context.params?.categoryId;

    if (!categoryId || !listContainer) {
        console.error("Category ID not found in state or list container not found.");
        if (listContainer) {
            listContainer.innerHTML = "<p>Could not load topics for this category.</p>";
        }
        return;
    }

    try {
        const [topics, category] = await Promise.all([
            getTopicsForCategory(categoryId),
            getCategoryById(categoryId)
        ]);
        
        if (category) {
            categoryTitle.textContent = category.name;
            categoryDescription.textContent = category.description;
        }

        if (topics && topics.length > 0) {
            listContainer.innerHTML = topics.map((topic, index) => `
                <a href="#loading" class="topic-item-link" data-topic-name="${topic.name}" data-topic-id="${topic.id}">
                    <div class="topic-item stagger-in" style="animation-delay: ${index * 80}ms;">
                        <span class="topic-icon">🧠</span>
                        <span class="topic-name">${topic.name}</span>
                        <span class="topic-arrow">→</span>
                    </div>
                </a>
            `).join('');
            
            // Use a single delegated event listener on the container
            listContainer.addEventListener('click', handleTopicClick);
            
            initializeCardGlow(); // Apply effect to newly rendered items

        } else {
            listContainer.innerHTML = "<p>No topics found for this category.</p>";
        }
    } catch (error) {
        console.error("Error fetching topics:", error);
        listContainer.innerHTML = "<p>An error occurred while loading topics.</p>";
    }
}

export function destroy() {
    if (listContainer) {
        // Remove the single delegated listener
        listContainer.removeEventListener('click', handleTopicClick);
    }
    appStateRef = null; // Clear reference
    console.log("Topic List module destroyed.");
}