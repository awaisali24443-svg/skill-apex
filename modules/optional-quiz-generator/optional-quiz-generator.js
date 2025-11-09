import { NUM_QUESTIONS } from '../../constants.js';
import { playSound } from '../../services/soundService.js';
import { startQuizFlow } from '../../services/navigationService.js';

console.log("Optional Quiz Generator module loaded.");

const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const studyGuideBtn = document.getElementById('study-guide-btn');
const difficultyButtonsContainer = document.querySelector('.difficulty-buttons');

let selectedDifficulty = 'Medium'; // Default

if (topicForm) {
    const updateButtonState = () => {
        const isDisabled = !topicInput.value.trim();
        if (generateQuizBtn) generateQuizBtn.disabled = isDisabled;
        if (studyGuideBtn) studyGuideBtn.disabled = isDisabled;
    };

    updateButtonState(); // Initial state

    if (topicInput) {
        topicInput.addEventListener('input', updateButtonState);
    }

    if (difficultyButtonsContainer) {
        difficultyButtonsContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.difficulty-btn');
            if (!target) return;

            // Update active state
            difficultyButtonsContainer.querySelector('.active')?.classList.remove('active');
            target.classList.add('active');

            selectedDifficulty = target.dataset.difficulty;
        });
    }

    studyGuideBtn?.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (!topic) return;

        playSound('start');

        const prompt = `Generate a concise study guide about "${topic}". The guide should be easy to understand for a beginner, using clear headings, bullet points, and bold text for key terms.`;
        const quizContext = {
            topicName: topic,
            isLeveled: false,
            prompt: prompt,
            returnHash: '#optional-quiz',
            generationType: 'study'
        };

        sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
        window.location.hash = '#loading';
    });

    topicForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        if (!topic) return;
        
        playSound('start');

        const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". The difficulty should be ${selectedDifficulty}.`;
        
        const quizContext = {
            topicName: topic,
            isLeveled: false, // Flag this as a non-leveled quiz
            prompt: prompt, // Store the prompt for retries
            returnHash: '#optional-quiz',
            generationType: 'quiz'
        };
        
        await startQuizFlow(quizContext);
    });
}