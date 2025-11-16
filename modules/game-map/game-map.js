import * as learningPathService from '../../services/learningPathService.js';

let appState;
let journey;
let elements = {};

function scrollToCurrent() {
    const currentNode = elements.path.querySelector('.level-node.current');
    if (currentNode) {
        currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function render() {
    elements.title.textContent = journey.goal;
    elements.progressText.textContent = `Completed ${journey.currentLevel - 1} of ${journey.totalLevels} levels`;
    
    const template = document.getElementById('level-node-template');
    elements.path.innerHTML = '';

    for (let i = 1; i <= journey.totalLevels; i++) {
        const node = template.content.cloneNode(true);
        const wrapper = node.querySelector('.level-node-wrapper');
        const nodeEl = node.querySelector('.level-node');
        
        nodeEl.dataset.level = i;
        wrapper.style.animationDelay = `${(i -1) * 20}ms`;

        const iconUse = nodeEl.querySelector('.level-node-icon use');
        const numberEl = nodeEl.querySelector('.level-node-number');
        const statusEl = nodeEl.querySelector('.level-node-status');

        numberEl.textContent = `Level ${i}`;

        if (i < journey.currentLevel) {
            nodeEl.classList.add('completed');
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#check-circle');
            statusEl.textContent = 'Replay';
            nodeEl.setAttribute('aria-label', `Level ${i}: Replay`);
        } else if (i === journey.currentLevel) {
            nodeEl.classList.add('current');
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#play');
            statusEl.textContent = 'Start Level';
            nodeEl.setAttribute('aria-label', `Level ${i}: Start`);
        } else {
            nodeEl.classList.add('locked');
            iconUse.setAttribute('href', 'assets/icons/feather-sprite.svg#lock');
            statusEl.textContent = 'Locked';
            nodeEl.setAttribute('aria-label', `Level ${i}: Locked`);
        }
        
        elements.path.appendChild(wrapper);
    }
    
    setTimeout(scrollToCurrent, 100);
}

function handlePathClick(event) {
    const node = event.target.closest('.level-node');
    if (node && !node.classList.contains('locked')) {
        const level = parseInt(node.dataset.level, 10);
        appState.context = {
            topic: journey.goal,
            level: level,
            journeyId: journey.id,
        };
        window.location.hash = '#/level';
    }
}

export function init(globalState) {
    appState = globalState;
    const topic = appState.context.params.topic || appState.context.topic;

    if (!topic) {
        console.error("No topic found for game map, redirecting.");
        window.location.hash = '/topics';
        return;
    }
    
    journey = learningPathService.startOrGetJourney(topic);

    elements = {
        title: document.getElementById('game-map-title'),
        progressText: document.getElementById('game-map-progress-text'),
        path: document.getElementById('game-map-path'),
        jumpBtn: document.getElementById('jump-to-current-btn'),
    };

    render();
    
    elements.path.addEventListener('click', handlePathClick);
    elements.jumpBtn.addEventListener('click', scrollToCurrent);
}

export function destroy() {
    // Event listeners on elements are cleaned up when the module is removed from DOM.
}