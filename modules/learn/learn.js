import { generateLearningContent } from '../../services/apiService.js';

let appState;
let elements = {};
let learningContent = null;

async function fetchAndRenderContent() {
    const { topic } = appState.context;
    if (!topic) {
        elements.loading.style.display = 'none';
        elements.error.style.display = 'block';
        return;
    }

    try {
        learningContent = await generateLearningContent({ topic });
        
        elements.title.textContent = learningContent.title;
        elements.summary.innerHTML = learningContent.summary.map(p => `<p>${p}</p>`).join('');

        elements.loading.style.display = 'none';
        elements.content.style.display = 'block';

    } catch (error) {
        console.error("Failed to fetch learning content:", error);
        elements.loading.style.display = 'none';
        elements.error.style.display = 'block';
    }
}

function handleStartQuiz() {
    // Pass the learning summary text as context to the next module
    appState.context.learningContext = learningContent.summary.join(' ');
    window.location.hash = '/loading';
}

export function init(globalState) {
    appState = globalState;
    elements = {
        loading: document.getElementById('learn-loading'),
        content: document.getElementById('learn-content'),
        error: document.getElementById('learn-error'),
        title: document.getElementById('learn-title'),
        summary: document.getElementById('learn-summary'),
        startQuizBtn: document.getElementById('start-quiz-from-learn-btn'),
    };
    
    elements.startQuizBtn.addEventListener('click', handleStartQuiz);
    fetchAndRenderContent();
}

export function destroy() {
    if (elements.startQuizBtn) {
        elements.startQuizBtn.removeEventListener('click', handleStartQuiz);
    }
    learningContent = null;
}
