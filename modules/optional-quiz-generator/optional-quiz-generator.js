import { NUM_QUESTIONS } from '../../constants.js';
import { playSound } from '../../services/soundService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let form;

let selectedDifficulty = 'Medium'; // Default

const updateButtonState = () => {
    const topicInput = document.getElementById('topic-input');
    const generateQuizBtn = document.getElementById('generate-quiz-btn');
    const studyGuideBtn = document.getElementById('study-guide-btn');
    const isDisabled = !topicInput.value.trim();
    if (generateQuizBtn) generateQuizBtn.disabled = isDisabled;
    if (studyGuideBtn) studyGuideBtn.disabled = isDisabled;
};

const handleDifficultySelect = (e) => {
    const target = e.target.closest('.difficulty-btn');
    if (!target) return;
    const container = e.currentTarget;
    container.querySelector('.active')?.classList.remove('active');
    target.classList.add('active');
    selectedDifficulty = target.dataset.difficulty;
};

const handleStudyGuide = async () => {
    const topic = document.getElementById('topic-input').value.trim();
    if (!topic) return;
    playSound('start');

    const prompt = `Generate a concise study guide about "${topic}". The guide should be easy to understand for a beginner, using clear headings, bullet points, and bold text for key terms.`;
    const quizContext = {
        topicName: topic,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#custom-quiz',
        generationType: 'study'
    };

    sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
    window.location.hash = '#loading';
};

const handleQuizSubmit = async (e) => {
    e.preventDefault();
    const topic = document.getElementById('topic-input').value.trim();
    if (!topic) return;
    playSound('start');

    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". The difficulty should be ${selectedDifficulty}.`;
    const quizContext = {
        topicName: topic,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#home', // Return to home after a custom quiz
        generationType: 'quiz'
    };
    await startQuizFlow(quizContext);
};

export function init() {
    sceneManager = initModuleScene('.background-canvas', 'dataStream');
    form = document.getElementById('topic-form');
    if (form) {
        updateButtonState();
        document.getElementById('topic-input')?.addEventListener('input', updateButtonState);
        document.querySelector('.difficulty-buttons')?.addEventListener('click', handleDifficultySelect);
        document.getElementById('study-guide-btn')?.addEventListener('click', handleStudyGuide);
        form.addEventListener('submit', handleQuizSubmit);
    }
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    if (form) {
        document.getElementById('topic-input')?.removeEventListener('input', updateButtonState);
        document.querySelector('.difficulty-buttons')?.removeEventListener('click', handleDifficultySelect);
        document.getElementById('study-guide-btn')?.removeEventListener('click', handleStudyGuide);
        form.removeEventListener('submit', handleQuizSubmit);
    }
}
