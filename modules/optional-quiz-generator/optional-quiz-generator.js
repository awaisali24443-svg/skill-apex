let appState;
let form;

function handleSubmit(event) {
    event.preventDefault();
    const topic = document.getElementById('topic-input').value;
    const numQuestions = document.getElementById('num-questions-select').value;
    const difficulty = document.getElementById('difficulty-select').value;
    
    if (topic.trim() === '') {
        // Basic validation
        document.getElementById('topic-input').focus();
        return;
    }

    appState.context = {
        topic,
        numQuestions: parseInt(numQuestions, 10),
        difficulty,
    };
    window.location.hash = '/loading';
}

export function init(globalState) {
    appState = globalState;
    form = document.getElementById('custom-quiz-form');
    form.addEventListener('submit', handleSubmit);
    document.getElementById('topic-input').focus();
}

export function destroy() {
    form.removeEventListener('submit', handleSubmit);
}
