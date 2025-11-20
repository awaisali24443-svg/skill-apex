import * as stateService from '../../services/stateService.js';
import * as libraryService from '../../services/libraryService.js';
import * as gamificationService from '../../services/gamificationService.js';

let context;
let elements = {};

function render() {
    elements.title.textContent = `Reviewing: Level ${context.level}`;
    elements.subtitle.textContent = context.topic;
    elements.backBtn.href = `#/game/${encodeURIComponent(context.topic)}`;

    elements.content.innerHTML = '';

    context.questions.forEach((question, index) => {
        const itemNode = elements.template.content.cloneNode(true);
        const itemEl = itemNode.querySelector('.review-item');
        
        itemEl.querySelector('.review-question-text').textContent = question.question;
        itemEl.querySelector('.review-explanation p').textContent = question.explanation;
        
        const saveBtn = itemEl.querySelector('.save-question-btn');
        if (libraryService.isQuestionSaved(question)) {
            saveBtn.classList.add('saved');
        }

        saveBtn.addEventListener('click', () => {
            // Optimistic UI Toggle
            const isSaved = saveBtn.classList.contains('saved');
            
            if (isSaved) {
                // Remove logic (not fully implemented in library service by object yet, so assume add only for this quest context usually)
                // But for now, let's just support saving.
                saveBtn.classList.remove('saved');
                const id = libraryService.hashQuestion(question.question);
                libraryService.removeQuestion(id);
            } else {
                saveBtn.classList.add('saved');
                // Pop animation
                saveBtn.animate([
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.4)' },
                    { transform: 'scale(1)' }
                ], { duration: 300 });
                
                libraryService.saveQuestion(question);
                gamificationService.checkQuestProgress({ type: 'save_question' });
            }
        });
        
        const optionsContainer = itemEl.querySelector('.review-options');
        const userAnswer = context.userAnswers[index];

        question.options.forEach((optionText, optionIndex) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'review-option';
            
            let iconHtml = '';
            const isCorrect = optionIndex === question.correctAnswerIndex;
            const isSelected = optionIndex === userAnswer;

            if (isCorrect) {
                optionEl.classList.add('correct');
                iconHtml = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#check-circle"/></svg>`;
            } else if (isSelected) {
                optionEl.classList.add('incorrect');
                iconHtml = `<svg class="icon"><use href="/assets/icons/feather-sprite.svg#x-circle"/></svg>`;
            } else {
                iconHtml = `<svg class="icon" style="color: var(--color-text-secondary);"><use href="/assets/icons/feather-sprite.svg#circle"/></svg>`;
            }
            
            optionEl.innerHTML = `${iconHtml} <span>${optionText}</span>`;
            optionsContainer.appendChild(optionEl);
        });

        elements.content.appendChild(itemNode);
    });
}

export function init() {
    const { navigationContext } = stateService.getState();
    context = navigationContext;

    if (!context || !context.questions || !context.userAnswers) {
        window.location.hash = '/';
        return;
    }

    elements = {
        title: document.getElementById('review-title'),
        subtitle: document.getElementById('review-subtitle'),
        content: document.getElementById('review-content'),
        backBtn: document.getElementById('back-to-map-btn'),
        template: document.getElementById('review-item-template'),
    };
    
    render();
}

export function destroy() {}