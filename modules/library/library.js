
import * as libraryService from '../../services/libraryService.js';

let container;
let clickHandler;
let studyBtn;

function renderLibrary() {
    if (!document.getElementById('library-grid')) return;

    container = document.getElementById('library-grid');
    studyBtn = document.getElementById('study-btn');
    const emptyMessage = document.getElementById('empty-library-message');
    const template = document.getElementById('library-item-template');
    
    // Force refresh data from storage in case it was just populated
    const questions = libraryService.getLibrary();
    container.innerHTML = '';

    if (questions.length === 0) {
        emptyMessage.style.display = 'block';
        studyBtn.disabled = true;
    } else {
        emptyMessage.style.display = 'none';
        studyBtn.disabled = false;
        
        questions.forEach((q, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.library-item');
            
            card.style.animationDelay = `${index * 50}ms`;
            card.dataset.id = q.id;
            
            card.querySelector('.library-question-text').textContent = q.question;
            card.querySelector('.remove-btn').dataset.id = q.id;
            
            container.appendChild(card);
        });
    }
}

export function init() {
    renderLibrary();

    clickHandler = (event) => {
        const removeButton = event.target.closest('.remove-btn');
        if (removeButton) {
            const questionId = removeButton.dataset.id;
            const card = document.querySelector(`.library-item[data-id="${questionId}"]`);
            if(card) {
                card.classList.add('removing');
                setTimeout(() => {
                    libraryService.removeQuestion(questionId);
                    renderLibrary();
                }, 300);
            }
        }
    };
    
    container = document.getElementById('library-grid');
    container.addEventListener('click', clickHandler);
    
    studyBtn = document.getElementById('study-btn');
    studyBtn.addEventListener('click', () => {
        if (!studyBtn.disabled) {
            window.location.hash = '/study';
        }
    });

    window.addEventListener('library-updated', renderLibrary);
}

export function destroy() {
    window.removeEventListener('library-updated', renderLibrary);
    if (container && clickHandler) {
        container.removeEventListener('click', clickHandler);
    }
}
