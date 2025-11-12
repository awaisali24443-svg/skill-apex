import { generateQuiz } from '../../services/apiService.js';
import * as quizStateService from '../../services/quizStateService.js';

let appState;
let cancelBtn;
let cancelTimer;

async function startGeneration() {
    const { topic, numQuestions, difficulty, learningPathId } = appState.context;

    if (!topic) {
        window.location.hash = '/';
        return;
    }

    document.getElementById('loading-topic').textContent = `Topic: "${topic}"`;

    try {
        const quizData = await generateQuiz({ topic, numQuestions, difficulty });

        if (!quizData || !quizData.questions || quizData.questions.length === 0) {
            throw new Error("The AI returned an empty or invalid quiz.");
        }
        
        // If this quiz is part of a learning path, attach the ID
        if (learningPathId) {
            quizData.learningPathId = learningPathId;
        }

        quizStateService.startQuiz(quizData);
        window.location.hash = '/quiz';

    } catch (error) {
        console.error("Quiz generation failed:", error);
        document.getElementById('loading-status').textContent = 'Generation Failed';
        document.getElementById('loading-status').style.color = 'var(--color-error)';
        const topicEl = document.getElementById('loading-topic');
        topicEl.textContent = error.message || 'There was an issue generating the quiz. The topic might be restricted or the service may be busy.';
        topicEl.style.fontSize = '1.1rem';

        document.querySelector('.spinner').style.display = 'none';
        document.querySelector('.loading-tip').style.display = 'none';
        cancelBtn.textContent = 'Go Back';
        cancelBtn.style.display = 'block';
    }
}

function cancelGeneration() {
    // A simple navigation back is the safest "cancel"
    window.history.back();
}

export function init(globalState) {
    appState = globalState;
    cancelBtn = document.getElementById('cancel-generation-btn');
    
    cancelTimer = setTimeout(() => {
        if(cancelBtn) cancelBtn.style.display = 'inline-flex';
    }, 5000);

    cancelBtn.addEventListener('click', cancelGeneration);
    startGeneration();
}

export function destroy() {
    clearTimeout(cancelTimer);
    if (cancelBtn) {
        cancelBtn.removeEventListener('click', cancelGeneration);
    }
}
