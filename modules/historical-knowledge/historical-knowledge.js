import * as progressService from '../../services/progressService.js';
import { MAX_LEVEL } from '../../constants.js';

console.log("Historical Knowledge module loaded.");

const topicGrid = document.querySelector('.topic-grid');
const topicCards = document.querySelectorAll('.topic-card');

const getLevelDescriptor = (level) => {
    const numericLevel = parseInt(level, 10);
    if (numericLevel >= MAX_LEVEL) return 'Master';
    if (numericLevel > 45) return 'Historian';
    if (numericLevel > 35) return 'Expert';
    if (numericLevel > 25) return 'Advanced';
    if (numericLevel > 15) return 'Intermediate';
    if (numericLevel > 5) return 'Beginner';
    return 'Noob';
};

topicCards.forEach(card => {
    // Update UI with progress
    const topic = card.dataset.topic;
    const level = progressService.getCurrentLevel(topic);
    const descriptor = getLevelDescriptor(level);

    const levelDisplayEl = card.querySelector('.level-display');
    const levelDescriptorEl = card.querySelector('.level-descriptor');
    if(levelDisplayEl) levelDisplayEl.textContent = `Level ${level}`;
    if(levelDescriptorEl) levelDescriptorEl.textContent = descriptor;
    card.setAttribute('aria-label', `Start ${topic} Quiz, Level ${level}`);
});


if (topicGrid) {
    topicGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.topic-card');
        if (card) {
            const topic = card.dataset.topic;
            const level = progressService.getCurrentLevel(topic);
            
            const prompt = `Generate a quiz on the key events, figures, and concepts of ${topic}. The difficulty should be level ${level} out of ${MAX_LEVEL}, where level 1 is for an absolute beginner (noob) and level ${MAX_LEVEL} is for a world-class expert. Adjust the complexity, depth, and obscurity of the questions accordingly.`;
            
            sessionStorage.setItem('quizTopicPrompt', prompt);
            sessionStorage.setItem('quizTopicName', topic);
            sessionStorage.setItem('quizLevel', level);
            sessionStorage.setItem('quizReturnHash', '#historical-knowledge');
            sessionStorage.setItem('quizCategory', 'history');

            window.location.hash = '#loading';
        }
    });
}
