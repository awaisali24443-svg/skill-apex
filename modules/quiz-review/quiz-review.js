


import * as stateService from '../../services/stateService.js';
import * as libraryService from '../../services/libraryService.js';
import * as gamificationService from '../../services/gamificationService.js';
import * as apiService from '../../services/apiService.js';

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
        const explanationP = itemEl.querySelector('.review-explanation p');
        explanationP.textContent = question.explanation;
        
        const saveBtn = itemEl.querySelector('.save-question-btn');
        if (libraryService.isQuestionSaved(question)) {
            saveBtn.classList.add('saved');
        }

        saveBtn.addEventListener('click', () => {
            const isSaved = saveBtn.classList.contains('saved');
            if (isSaved) {
                saveBtn.classList.remove('saved');
                const id = libraryService.hashQuestion(question.question);
                libraryService.removeQuestion(id);
            } else {
                saveBtn.classList.add('saved');
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
        const isWrong = userAnswer !== question.correctAnswerIndex && userAnswer !== undefined && userAnswer !== -1;

        if (isWrong) {
            const explainBtn = document.createElement('button');
            explainBtn.className = 'btn btn-small explain-error-btn';
            explainBtn.style.marginTop = '10px';
            explainBtn.innerHTML = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#lightbulb"/></svg> Why was I wrong?`;
            
            explainBtn.onclick = async () => {
                explainBtn.disabled = true;
                explainBtn.innerHTML = `<div class="btn-spinner"></div> Analyzing...`;
                try {
                    const userOption = question.options[userAnswer];
                    const correctOption = question.options[question.correctAnswerIndex];
                    const result = await apiService.explainError(context.topic, question.question, userOption, correctOption);
                    
                    const errorExpDiv = document.createElement('div');
                    errorExpDiv.style.backgroundColor = 'var(--color-error-bg)';
                    errorExpDiv.style.padding = '10px';
                    errorExpDiv.style.marginTop = '10px';
                    errorExpDiv.style.borderRadius = 'var(--border-radius)';
                    errorExpDiv.innerHTML = `<strong>AI Analysis:</strong> ${result.explanation}`;
                    
                    itemEl.querySelector('.review-explanation').appendChild(errorExpDiv);
                    explainBtn.remove();
                } catch(e) {
                    explainBtn.textContent = "Failed to explain";
                    explainBtn.disabled = false;
                }
            };
            itemEl.querySelector('.review-explanation').appendChild(explainBtn);
        }

        question.options.forEach((optionText, optionIndex) => {
            const optionEl = document.createElement('div');
            optionEl.className = 'review-option';
            
            let iconHtml = '';
            const isCorrect = optionIndex === question.correctAnswerIndex;
            const isSelected = optionIndex === userAnswer;

            if (isCorrect) {
                optionEl.classList.add('correct');
                iconHtml = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#check-circle"/></svg>`;
            } else if (isSelected) {
                optionEl.classList.add('incorrect');
                iconHtml = `<svg class="icon"><use href="assets/icons/feather-sprite.svg#x-circle"/></svg>`;
            } else {
                iconHtml = `<svg class="icon" style="color: var(--color-text-secondary);"><use href="assets/icons/feather-sprite.svg#circle"/></svg>`;
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
