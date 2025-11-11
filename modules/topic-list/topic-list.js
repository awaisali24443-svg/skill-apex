
import { getTopicsForCategory, getCategoryById } from '../../services/topicService.js';

let listContainer;
let appStateRef;

const handleTopicClick = (e) => {
    const link = e.target.closest('.topic-item-link');
    if (!link) return;

    e.preventDefault();
    const selectedTopic = link.dataset.topic;
    
    // Use the stored appState reference to modify the context
    if (appStateRef) {
        appStateRef.context = { topic: selectedTopic };
    }
    
    window.location.hash = link.getAttribute('href');
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
            listContainer.innerHTML = topics.map(topic => `
                <a href="#loading" class="topic-item-link" data-topic="${topic.name}">
                    <div class="topic-item">
                        <span class="topic-icon">🧠</span>
                        <span class="topic-name">${topic.name}</span>
                        <span class="topic-arrow">→</span>
                    </div>
                </a>
            `).join('');
            
            // Use a single delegated event listener on the container
            listContainer.addEventListener('click', handleTopicClick);

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