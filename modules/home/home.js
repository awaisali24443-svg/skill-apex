import { categoryData } from '../../services/topicService.js';
import { NUM_QUESTIONS } from '../../constants.js';
import { playSound } from '../../services/soundService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { getProgress } from '../../services/progressService.js';

console.log("Home module (Dashboard) loaded.");

function animateFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.animation = `popIn 0.5s ease-out ${index * 0.1}s forwards`;
        card.style.opacity = '0';
    });
}

async function handleSurpriseMe(e) {
    e.preventDefault();
    playSound('start');

    // Flatten all topics from all categories into a single array
    const allTopics = Object.values(categoryData).flatMap(category => category.topics);
    const randomTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
    const topicName = randomTopic.name;

    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be Medium.`;
    
    const quizContext = {
        topicName: topicName,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#home'
    };
    
    await startQuizFlow(quizContext, prompt);
}

function personalizeDashboard() {
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const { stats } = getProgress();
    const subtitleEl = document.querySelector('.main-home-subtitle');
    
    if (subtitleEl) {
        let greeting = `Ready to test your knowledge, ${profile.name || 'friend'}?`;
        if (stats.streak > 0) {
            greeting += ` You're on a ${stats.streak}-day streak, keep it up!`;
        }
        subtitleEl.textContent = greeting;
    }
}

const surpriseMeCard = document.getElementById('surprise-me-card');
if (surpriseMeCard) {
    surpriseMeCard.addEventListener('click', handleSurpriseMe);
}

animateFeatureCards();
personalizeDashboard();