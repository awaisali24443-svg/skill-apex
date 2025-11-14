import * as libraryService from '../../services/libraryService.js';

let container;
let clickHandler;
let studyBtn;

function renderLibrary() {
    container = document.getElementById('library-grid');
    studyBtn = document.getElementById('study-btn');
    const emptyMessage = document.getElementById('empty-library-message');
    const template = document.getElementById('library-item-template');
    
    const questions = libraryService.getLibrary();
    container.innerHTML = '';

    if (questions.length === 0) {
        emptyMessage.style.display = 'block';
        studyBtn.disabled = true;
    } else {
        emptyMessage.style.display = 'none';
        studyBtn.disabled = false;
        questions.forEach(q => {
            const card = template.content.cloneNode(true);
            const cardElement = card.querySelector('.library-item');
            cardElement.dataset.id = q.id;
            card.querySelector('.library-question-text').textContent = q.question;
            card.querySelector('.remove-btn').dataset.id = q.id;
            container.appendChild(card);
        });
    }
}

export function init(appState) {
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
                    renderLibrary(); // Re-render to reflect the change
                }, 300);
            }
        }
    };
    
    container.addEventListener('click', clickHandler);
    studyBtn.addEventListener('click', () => {
        if (!studyBtn.disabled) {
            window.location.hash = '/study';
        }
    });
}

export function destroy() {
    if (container && clickHandler) {
        container.removeEventListener('click', clickHandler);
    }
    // No need to remove listener from studyBtn as it's part of the module's static HTML
}
