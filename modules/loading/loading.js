import { generateQuiz } from '../../services/geminiService.js';
import * as quizState from '../../services/quizStateService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let quizContext = null;
let messageInterval;

const loadingMessages = [
    "Consulting the digital oracle...",
    "Waking up the AI spirits...",
    "Translating knowledge from the ether...",
    "Reticulating splines...",
    "Asking the silicon brain...",
    "Forging questions in the digital anvil...",
];

function showLoadingState(context) {
    document.getElementById('spinner-wrapper').classList.remove('hidden');
    document.getElementById('error-container').classList.add('hidden');
    
    const titleAction = context.generationType === 'study' ? 'Crafting Study Guide' : 'Forging Quiz';
    document.getElementById('loading-topic-title').textContent = `${titleAction} on ${context.topicName}`;
    
    const loadingTextEl = document.getElementById('loading-text');
    let messageIndex = 0;
    loadingTextEl.textContent = loadingMessages[messageIndex];
    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        loadingTextEl.textContent = loadingMessages[messageIndex];
    }, 2500);
}

function showErrorState(message) {
    clearInterval(messageInterval);
    document.getElementById('spinner-wrapper').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');
    document.getElementById('error-details').textContent = message;
}

async function generateContent() {
    showLoadingState(quizContext);
    
    try {
        if (quizContext.generationType === 'study') {
            sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
            window.location.hash = '#study';
        } else {
            const quizData = await generateQuiz(quizContext.prompt);
            quizState.startNewQuizState(quizData, quizContext);
            window.location.hash = '#quiz';
        }
    } catch (error) {
        console.error("Error during content generation:", error);
        showErrorState(error.message || "An unexpected error occurred.");
    } finally {
        clearInterval(messageInterval);
    }
}

function handleGoBack() {
    window.location.hash = quizContext?.returnHash || '#home';
}

export function init() {
    const contextString = sessionStorage.getItem('quizContext');
    if (!contextString) {
        showErrorState("No quiz context found. Please start a new quiz.");
        document.getElementById('go-back-btn').addEventListener('click', () => window.location.hash = '#home', { once: true });
        return;
    }
    quizContext = JSON.parse(contextString);

    document.getElementById('try-again-btn').addEventListener('click', generateContent);
    document.getElementById('go-back-btn').addEventListener('click', handleGoBack);

    generateContent();
    sceneManager = initModuleScene('.background-canvas', 'dataStream');
}

export function cleanup() {
    clearInterval(messageInterval);
    sceneManager = cleanupModuleScene(sceneManager);
    quizContext = null;
}
