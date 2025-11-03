import { generateQuiz } from '../welcome/services/geminiService.js';

const loadingTextElement = document.getElementById('loading-text');

const messages = [
    "Warming up the AI...",
    "Gathering knowledge particles...",
    "Consulting the digital oracle...",
    "Crafting challenging questions...",
    "Polishing the options...",
    "Just a moment more..."
];

let messageInterval;

async function startQuizGeneration() {
    if (!loadingTextElement) return;

    let messageIndex = 0;
    loadingTextElement.textContent = messages[messageIndex];

    messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        // Fade out
        loadingTextElement.style.opacity = '0';
        setTimeout(() => {
            // Change text and fade in
            loadingTextElement.textContent = messages[messageIndex];
            loadingTextElement.style.opacity = '1';
        }, 300);
    }, 2000); // Change message every 2 seconds

    const topic = sessionStorage.getItem('quizTopic');
    if (!topic) {
        console.error("No topic found for quiz generation.");
        sessionStorage.setItem('quizError', 'Something went wrong. Please select a topic again.');
        window.location.hash = '#quiz'; // Go back to the main quiz page
        return;
    }

    try {
        const quizData = await generateQuiz(topic);
        sessionStorage.setItem('generatedQuizData', JSON.stringify(quizData));
        sessionStorage.removeItem('quizTopic'); // Clean up
        window.location.hash = '#quiz';
    } catch (error) {
        console.error("Failed to generate quiz:", error);
        sessionStorage.setItem('quizError', error.message || 'Failed to generate the quiz. Please try another topic.');
        sessionStorage.removeItem('quizTopic');
        window.location.hash = '#quiz';
    }
}

function cleanup() {
    if (messageInterval) {
        clearInterval(messageInterval);
    }
}

// Add a listener to clean up when the user navigates away, e.g., if the API call finishes.
// This prevents the interval from running on the next page.
window.addEventListener('hashchange', cleanup, { once: true });

startQuizGeneration();