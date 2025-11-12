import * as learningPathService from '../../services/learningPathService.js';
import { initializeCardGlow } from '../../global/global.js';

let appState;
let path;
let stepsList;
let clickHandler;

function renderPath() {
    document.getElementById('path-goal-title').textContent = path.goal;
    document.getElementById('path-progress-summary').textContent = `Step ${path.currentStep + 1} of ${path.path.length}`;
    
    stepsList = document.getElementById('path-steps-list');
    const template = document.getElementById('step-item-template');
    stepsList.innerHTML = '';

    path.path.forEach((step, index) => {
        const item = template.content.cloneNode(true);
        const card = item.querySelector('.step-item');
        
        item.querySelector('.step-number').textContent = index + 1;
        item.querySelector('.step-name').textContent = step.name;
        const button = item.querySelector('.start-topic-btn');
        button.dataset.topic = step.topic;

        if (index < path.currentStep) {
            card.classList.add('completed');
        } else if (index === path.currentStep) {
            card.classList.add('current');
        } else {
            card.classList.add('locked');
        }
        stepsList.appendChild(item);
    });
    initializeCardGlow(stepsList);
}

export function init(globalState) {
    appState = globalState;
    const pathId = appState.context.params.id;
    path = learningPathService.getPathById(pathId);

    if (!path) {
        window.location.hash = '/learning-path-generator';
        return;
    }

    renderPath();

    clickHandler = (event) => {
        const button = event.target.closest('.start-topic-btn');
        if (button) {
            appState.context = {
                topic: button.dataset.topic,
                numQuestions: 10,
                difficulty: 'medium',
                learningPathId: path.id,
            };
            window.location.hash = '/loading';
        }
    };
    stepsList.addEventListener('click', clickHandler);
}

export function destroy() {
    if (stepsList && clickHandler) {
        stepsList.removeEventListener('click', clickHandler);
    }
}
