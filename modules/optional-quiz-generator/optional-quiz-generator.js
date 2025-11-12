let appState;
let form, topicInput, numQuestionsSelect, difficultySelect;

function handleSubmit(event) {
    event.preventDefault();
    const topic = topicInput.value;
    const numQuestions = numQuestionsSelect.value;
    const difficulty = difficultySelect.value;
    
    if (topic.trim() === '') {
        topicInput.focus();
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
    topicInput = document.getElementById('topic-input');
    numQuestionsSelect = document.getElementById('num-questions-select');
    difficultySelect = document.getElementById('difficulty-select');

    form.addEventListener('submit', handleSubmit);
    topicInput.focus();
}

export function destroy() {
    if (form) {
        form.removeEventListener('submit', handleSubmit);
    }
}