import { getSavedQuestions, removeQuestion } from '../../services/libraryService.js';
import { initializeCardGlow } from '../../global/global.js';

let container;

function renderSavedQuestions() {
    const questions = getSavedQuestions();
    const emptyState = document.getElementById('library-empty-state');
    const libraryActions = document.getElementById('library-actions');
    
    if (questions.length === 0) {
        emptyState.style.display = 'block';
        libraryActions.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    emptyState.style.display = 'none';
    libraryActions.style.display = 'block';
    
    container.innerHTML = ''; // Clear previous content
    const fragment = document.createDocumentFragment();

    questions.forEach((q, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'saved-question-item stagger-in';
        itemEl.style.animationDelay = `${index * 80}ms`;
        itemEl.innerHTML = `
            <p class="saved-question-text">${q.question}</p>
            <ul class="saved-options-list">
                ${q.options.map((opt, i) => `
                    <li class="saved-option ${i === q.correctAnswerIndex ? 'correct' : ''}">
                        ${opt}
                    </li>
                `).join('')}
            </ul>
            <button class="remove-btn" title="Remove from library">&times;</button>
        `;
        
        const removeBtn = itemEl.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => handleRemove(q, itemEl));

        fragment.appendChild(itemEl);
    });
    container.appendChild(fragment);
    
    initializeCardGlow(); // Apply effect to newly rendered items
}

function handleRemove(question, element) {
    removeQuestion(question);
    // Animate removal before removing from DOM
    element.style.transition = 'opacity 0.3s, transform 0.3s, max-height 0.3s, padding 0.3s, margin 0.3s';
    element.style.opacity = '0';
    element.style.transform = 'translateX(-20px)';
    element.style.maxHeight = '0px';
    element.style.paddingTop = '0';
    element.style.paddingBottom = '0';
    element.style.marginBottom = '0';

    setTimeout(() => {
        element.remove();
        // Check if the library is now empty and show the empty state if needed
        if (getSavedQuestions().length === 0) {
            renderSavedQuestions();
        }
    }, 300);
}

export function init() {
    container = document.getElementById('library-container');
    renderSavedQuestions();
}

export function destroy() {
    console.log("Library module destroyed.");
}