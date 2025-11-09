import { generateQuiz } from '../../services/geminiService.js';
import * as quizState from '../../services/quizStateService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let quizContext = null;

// DOM Elements
const spinnerWrapper = document.getElementById('spinner-wrapper');
const errorContainer = document.getElementById('error-container');
const loadingText = document.getElementById('loading-text');
const loadingTopicTitle = document.getElementById('loading-topic-title');
const tryAgainBtn = document.getElementById('try-again-btn');
const goBackBtn = document.getElementById('go-back-btn');
const errorDetails = document.getElementById('error-details');

const loadingMessages = [
    "Consulting the digital oracle...",
    "Waking up the AI spirits...",
    "Translating knowledge from the ether...",
    "Reticulating splines...",
    "Asking the silicon brain...",
    "Forging questions in the digital anvil...",
];

let messageInterval;

function showLoadingState(context) {
    spinnerWrapper.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    
    const titleAction = context.generationType === 'study' ? 'Crafting Study Guide' : 'Forging Quiz';
    loadingTopicTitle.textContent = `${titleAction} on ${context.topicName}`;
    
    let messageIndex = 0;
    loadingText.textContent = loadingMessages[messageIndex];
    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        loadingText.textContent = loadingMessages[messageIndex];
    }, 2500);
}

function showErrorState(message) {
    clearInterval(messageInterval);
    spinnerWrapper.classList.add('hidden');
    errorContainer.classList.remove('hidden');
    errorDetails.textContent = message;
}

async function generateContent() {
    showLoadingState(quizContext);
    
    try {
        if (quizContext.generationType === 'study') {
            // Study guide generation is streamed directly on the study page.
            // This loading module just needs to pass the context and navigate.
            sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
            window.location.hash = '#study';
        } else {
            // It's a quiz generation
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

function init() {
    const contextString = sessionStorage.getItem('quizContext');
    if (!contextString) {
        showErrorState("No quiz context found. Please start a new quiz.");
        goBackBtn.removeEventListener('click', handleGoBack);
        goBackBtn.addEventListener('click', () => window.location.hash = '#home');
        return;
    }
    quizContext = JSON.parse(contextString);

    tryAgainBtn.addEventListener('click', generateContent);
    goBackBtn.addEventListener('click', handleGoBack);

    generateContent();
    sceneManager = initModuleScene('.background-canvas', 'dataStream');
}

function cleanup() {
    clearInterval(messageInterval);
    sceneManager = cleanupModuleScene(sceneManager);
}

// Use MutationObserver for robust cleanup
const observer = new MutationObserver((mutationsList, obs) => {
    if (!document.querySelector('.loading-container')) {
        cleanup();
        obs.disconnect();
    }
});
observer.observe(document.getElementById('root-container'), { childList: true, subtree: true });

init();
