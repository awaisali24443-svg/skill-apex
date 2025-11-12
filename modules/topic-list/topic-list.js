import { fetchTopics } from '../../services/apiService.js';
import { initializeCardGlow } from '../../global/global.js';

let container;
let clickHandler;

function renderTopics(appState) {
    container = document.getElementById('topic-categories-container');
    const template = document.getElementById('category-template');

    fetchTopics().then(categories => {
        container.innerHTML = ''; // Clear spinner

        categories.forEach(category => {
            const card = template.content.cloneNode(true);

            const iconUse = card.querySelector('.category-icon use');
            if (category.icon) {
                iconUse.setAttribute('href', `/assets/icons/feather-sprite.svg#${category.icon}`);
            } else {
                card.querySelector('.category-icon').style.display = 'none';
            }
            
            card.querySelector('.category-title').textContent = category.category;
            card.querySelector('.category-description').textContent = category.description;

            const buttonsContainer = card.querySelector('.topic-buttons');
            category.topics.forEach(topic => {
                const button = document.createElement('a');
                button.href = '#';
                button.className = 'topic-button';
                button.textContent = topic.name;
                button.dataset.topic = topic.name;
                button.dataset.difficulty = topic.difficulty;
                buttonsContainer.appendChild(button);
            });

            container.appendChild(card);
        });
        
        initializeCardGlow(container);

        clickHandler = (event) => {
            if (event.target.classList.contains('topic-button')) {
                event.preventDefault();
                const topic = event.target.dataset.topic;
                appState.context = {
                    topic: topic,
                    numQuestions: 10,
                    difficulty: event.target.dataset.difficulty || 'medium',
                };
                window.location.hash = '/loading';
            }
        };
        container.addEventListener('click', clickHandler);

    }).catch(error => {
        container.innerHTML = `<p class="error-message">Could not load topics. Please try again later.</p>`;
    });
}

export function init(appState) {
    renderTopics(appState);
}

export function destroy() {
    if (container && clickHandler) {
        container.removeEventListener('click', clickHandler);
    }
}