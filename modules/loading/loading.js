import { generateQuiz, generateStudyGuide } from '../../services/geminiService.js';
import * as quizState from '../../services/quizStateService.js';

const spinnerWrapper = document.getElementById('spinner-wrapper');
const errorContainer = document.getElementById('error-container');
const loadingTextElement = document.getElementById('loading-text');
const topicTitleElement = document.getElementById('loading-topic-title');

const messages = {
    quiz: {
        'default': [
            "Asking the silicon brain...", "Reticulating splines for maximum quizitude...",
            "Translating universal knowledge...", "Aligning the knowledge crystals...",
            "Constructing cognitive challenges...", "Sorting bytes of pure wisdom...",
            "Summoning the quiz spirits...", "Charging the neural networks...",
            "Engaging the AI's creative mode..."
        ]
    },
    study: {
        'default': [
            "Distilling the core knowledge...", "Synthesizing key concepts for you...",
            "Consulting the archives of information...", "Structuring the learning material...",
            "Building a foundation of facts...", "Making complex topics simple..."
        ]
    }
};

let messageInterval;
let quizContext = {};

function showLoadingState() {
    if (topicTitleElement && quizContext.topicName) {
        const actionText = quizContext.generationType === 'study' ? 'Building Study Guide' : 'Forging Your Quiz';
        topicTitleElement.textContent = `${actionText} on "${quizContext.topicName}"`;
    }
    spinnerWrapper.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    startLoadingMessages();
}

function showErrorState(errorMessage) {
    clearInterval(messageInterval);
    spinnerWrapper.classList.add('hidden');
    errorContainer.classList.remove('hidden');

    const errorDetails = errorContainer.querySelector('#error-details');
    errorDetails.textContent = errorMessage;

    const tryAgainBtn = errorContainer.querySelector('#try-again-btn');
    const goBackBtn = errorContainer.querySelector('#go-back-btn');

    tryAgainBtn.onclick = () => {
        showLoadingState();
        startGeneration();
    };

    goBackBtn.onclick = () => {
        window.location.hash = quizContext.returnHash || '#home';
    };
}

function startLoadingMessages() {
    if (!loadingTextElement) return;
    
    const type = quizContext.generationType || 'quiz';
    let availableMessages = messages[type]?.default || messages.quiz.default;
    
    availableMessages = [...availableMessages].sort(() => Math.random() - 0.5);

    let messageIndex = 0;
    loadingTextElement.textContent = availableMessages[messageIndex];

    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % availableMessages.length;
        loadingTextElement.style.opacity = '0';
        setTimeout(() => {
            loadingTextElement.textContent = availableMessages[messageIndex];
            loadingTextElement.style.opacity = '1';
        }, 300);
    }, 2500);
}

async function startGeneration() {
    if (!quizContext.prompt) {
        showErrorState('Something went wrong. The generation prompt was not found. Please try again.');
        return;
    }

    try {
        if (quizContext.generationType === 'study') {
            const systemInstruction = `You are an AI study guide creator for "Knowledge Tester". Your goal is to make learning accessible and clear. Use a natural, encouraging tone. Format your response in simple markdown with headings, lists, and bold text.`;
            const studyGuideContent = await generateStudyGuide(quizContext.prompt, systemInstruction);
            sessionStorage.setItem('studyGuideContent', studyGuideContent);
            sessionStorage.setItem('quizContext', JSON.stringify(quizContext)); // Pass context to study page
            window.location.hash = '#study';
        } else { // Default to quiz generation
            const systemInstruction = `You are an AI quiz maker for "Knowledge Tester". Your goal is to make learning fun and engaging, so use a natural, human-like, conversational tone as if you're a friendly teacher or quiz host. Avoid robotic, academic language. Before finalizing, please re-read your questions to ensure they sound natural and conversational.`;
            const quizData = await generateQuiz(quizContext.prompt, systemInstruction);
            quizState.startNewQuizState(quizData, quizContext);
            window.location.hash = '#quiz';
        }
    } catch (error) {
        console.error("Failed to generate content:", error);
        showErrorState(error.message || 'An unknown error occurred. Please try another topic.');
    } finally {
        sessionStorage.removeItem('moduleContext'); // Clean up after generation attempt
    }
}

function init() {
    const contextString = sessionStorage.getItem('quizContext');
    if (!contextString) {
        showErrorState("Could not initialize generation. No context found.");
        return;
    }
    quizContext = JSON.parse(contextString);

    showLoadingState();
    startGeneration();
}

// Cleanup interval when the user navigates away
window.addEventListener('hashchange', () => {
    if (messageInterval) clearInterval(messageInterval);
}, { once: true });

init();