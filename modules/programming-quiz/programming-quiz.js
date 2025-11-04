import { initCard, cleanup } from '../../services/threeManager.js';
import * as progressService from '../../services/progressService.js';
import { NUM_QUESTIONS, MAX_LEVEL } from '../../constants.js';
import { playSound } from '../../services/soundService.js';

console.log("Programming Quiz module loaded.");

const levelDescriptors = {
    1: "Noob", 10: "Beginner", 20: "Intermediate", 
    30: "Advanced", 40: "Expert", 50: "Master"
};

function getLevelDescriptor(level) {
    const keys = Object.keys(levelDescriptors).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
        if (level >= key) {
            return levelDescriptors[key];
        }
    }
    return "Noob";
}

function handleTopicSelect(event) {
    const card = event.currentTarget;
    const topic = card.dataset.topic;
    if (!topic) return;

    playSound('start');

    const level = progressService.getCurrentLevel(topic);
    const descriptor = getLevelDescriptor(level);

    // Store context for the quiz and results page
    const quizContext = {
        topicName: topic,
        level: level,
        returnHash: '#programming-quiz'
    };
    sessionStorage.setItem('quizContext', JSON.stringify(quizContext));

    // Create a more detailed prompt for the AI
    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about the programming language "${topic}". The difficulty should be for an expert at Level ${level} out of ${MAX_LEVEL} (${descriptor} level). The questions should be highly specific and technical, suitable for someone with deep experience. Ensure all questions are unique and cover different aspects of the topic.`;
    sessionStorage.setItem('quizTopicPrompt', prompt);
    sessionStorage.setItem('quizTopicName', topic); // For loading messages

    // Navigate to loading screen
    window.location.hash = '#loading';
}


function initializeTopicCards() {
    // Clean up any previous 3D scenes before creating new ones
    cleanup();
    
    const topicCards = document.querySelectorAll('.topic-card');
    topicCards.forEach(card => {
        const topic = card.dataset.topic;
        const level = progressService.getCurrentLevel(topic);
        const descriptor = getLevelDescriptor(level);

        const levelDisplay = card.querySelector('.level-display');
        const levelDescriptorEl = card.querySelector('.level-descriptor');
        
        if (levelDisplay) levelDisplay.textContent = `Level ${level}`;
        if (levelDescriptorEl) levelDescriptorEl.textContent = descriptor;
        
        card.addEventListener('click', handleTopicSelect);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleTopicSelect(e);
            }
        });

        // Initialize 3D scene
        initCard(card);
    });
}

// Initial setup
initializeTopicCards();