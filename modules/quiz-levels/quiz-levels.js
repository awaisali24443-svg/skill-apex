
let appState;
let elements = {};
let clickHandler;
let keydownHandler;

function handleLevelSelect(event) {
    const card = event.target.closest('.level-card');
    if (!card) return;

    const topic = appState.context.topic;
    const numQuestions = parseInt(card.dataset.numQuestions, 10);
    const difficulty = card.dataset.difficulty;

    appState.context = {
        topic,
        numQuestions,
        difficulty,
    };
    window.location.hash = '/loading';
}

export function init(globalState) {
    appState = globalState;
    const topic = appState.context.topic;

    if (!topic) {
        // Redirect if a topic wasn't passed in context
        window.location.hash = '/topics';
        return;
    }

    elements = {
        topicTitle: document.getElementById('quiz-levels-topic'),
        levelsList: document.getElementById('levels-list'),
        backBtn: document.getElementById('back-to-topics-btn'),
    };

    elements.topicTitle.textContent = topic;
    
    clickHandler = handleLevelSelect;
    keydownHandler = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLevelSelect(e);
        }
    };

    elements.levelsList.addEventListener('click', clickHandler);
    elements.levelsList.addEventListener('keydown', keydownHandler);
    
    elements.backBtn.addEventListener('click', () => {
        window.location.hash = '/topics';
    });
}

export function destroy() {
    if (elements.levelsList) {
        if (clickHandler) elements.levelsList.removeEventListener('click', clickHandler);
        if (keydownHandler) elements.levelsList.removeEventListener('keydown', keydownHandler);
    }
}
