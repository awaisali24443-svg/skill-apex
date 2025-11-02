// optional-quiz-generator.js - Logic for the quiz topic selection

const topicForm = document.getElementById('topic-form');
const topicInput = document.getElementById('topic-input');
const generateQuizBtn = document.getElementById('generate-quiz-btn');
const errorMessage = document.getElementById('error-message');

if (topicForm) {
    // Disable button initially
    generateQuizBtn.disabled = true;

    topicInput.addEventListener('input', () => {
        // Enable button only if there is text
        generateQuizBtn.disabled = !topicInput.value.trim();
    });

    topicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        if (!topic) return;

        // Store the topic for the main quiz module to access
        sessionStorage.setItem('quizTopic', topic);
        
        // Navigate to the main quiz module
        window.location.hash = '#main';
    });
}