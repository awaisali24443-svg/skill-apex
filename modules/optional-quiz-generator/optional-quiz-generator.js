import { NUM_QUESTIONS } from '../../constants.js';
import { playSound } from '../../services/soundService.js';

console.log("Optional Quiz Generator module loaded.");

const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const difficultyButtonsContainer = document.querySelector('.difficulty-buttons');

let selectedDifficulty = 'Medium'; // Default

if (topicForm) {
    if (generateQuizBtn) {
        generateQuizBtn.disabled = !topicInput.value.trim();
    }

    if (topicInput) {
        topicInput.addEventListener('input', () => {
            if (generateQuizBtn) {
                generateQuizBtn.disabled = !topicInput.value.trim();
            }
        });
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

    topicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        if (!topic) return;
        
        playSound('start');

        const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". The difficulty should be ${selectedDifficulty}. Ensure all questions are unique and cover different aspects of the topic.`;
        
        const quizContext = {
            topicName: topic,
            isLeveled: false, // Flag this as a non-leveled quiz
            prompt: prompt, // Store the prompt for retries
            returnHash: '#optional-quiz'
        };
        sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
        sessionStorage.setItem('quizTopicPrompt', prompt);
        sessionStorage.setItem('quizTopicName', topic);

        window.location.hash = '#loading';
    });
}