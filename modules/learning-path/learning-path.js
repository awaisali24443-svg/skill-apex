import * as learningPathService from '../../services/learningPathService.js';

let appState;
let path;
let stepsList;
let clickHandler;

function renderPath() {
    document.getElementById('path-goal-title').textContent = path.goal;
    const completedSteps = path.path.length === path.currentStep ? path.currentStep : path.currentStep;
    document.getElementById('path-progress-summary').textContent = `Progress: ${completedSteps} / ${path.path.length} steps completed`;
    
    stepsList = document.getElementById('path-steps-list');
    const template = document.getElementById('step-item-template');
    stepsList.innerHTML = '';

    path.path.forEach((step, index) => {
        const item = template.content.cloneNode(true);
        const card = item.querySelector('.step-item');
        const iconUse = item.querySelector('.step-icon use');
        
        item.querySelector('.step-name').textContent = step.name;
        const button = item.querySelector('.start-topic-btn');
        button.dataset.topic = step.topic;

        if (index < path.currentStep) {
            card.classList.add('completed');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#check-circle');
        } else if (index === path.currentStep) {
            card.classList.add('current');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#target');
        } else {
            card.classList.add('locked');
            iconUse.setAttribute('href', '/assets/icons/feather-sprite.svg#lock');
        }
        stepsList.appendChild(item);
    });
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
