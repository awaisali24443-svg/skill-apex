import * as progressService from '../../services/progressService.js';
import { NUM_QUESTIONS, MAX_LEVEL } from '../../constants.js';
import { categoryData } from '../../services/topicService.js';
import { startQuizFlow } from '../../services/navigationService.js';

console.log("Unified Topic List module loaded.");

const levelDescriptors = {
    1: "Noob", 10: "Beginner", 20: "Intermediate", 
    30: "Advanced", 40: "Expert", 50: "Master"
};

function getLevelDescriptor(level) {
    const keys = Object.keys(levelDescriptors).map(Number).sort((a, b) => b - a);
    for (const key of keys) {
        if (level >= key) return levelDescriptors[key];
    }
    return "Noob";
}

async function handleStartQuiz(event) {
    const button = event.currentTarget;
    const topic = button.dataset.topic;
    const returnHash = button.dataset.returnHash;
    if (!topic) return;

    const level = progressService.getCurrentLevel(topic);
    const descriptor = getLevelDescriptor(level);

    const prompt = `Create a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". The difficulty should be for a user at Level ${level} of ${MAX_LEVEL} (${descriptor}).`;
    
    const quizContext = { 
        topicName: topic, 
        level: level, 
        returnHash: returnHash,
        isLeveled: true,
        prompt: prompt,
        generationType: 'quiz'
    };

    await startQuizFlow(quizContext);
}

function handleStartStudyGuide(event) {
    const button = event.currentTarget;
    const topic = button.dataset.topic;
    const returnHash = button.dataset.returnHash;
    if (!topic) return;

    const prompt = `Generate a concise study guide about "${topic}". The guide should be easy to understand for a beginner, using clear headings, bullet points, and bold text for key terms.`;
    const quizContext = {
        topicName: topic,
        level: progressService.getCurrentLevel(topic), // Pass level for context
        returnHash: returnHash,
        isLeveled: true,
        prompt: prompt,
        generationType: 'study'
    };
    
    sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
    window.location.hash = '#loading';
}

function renderTopicCards(category) {
    const data = categoryData[category];
    if (!data) {
        console.error(`Category "${category}" not found.`);
        document.getElementById('topic-grid').innerHTML = `<p>Invalid category selected.</p>`;
        return;
    }
    
    document.getElementById('category-title').textContent = data.title;
    document.getElementById('category-subtitle').textContent = data.subtitle;

    const topicGrid = document.getElementById('topic-grid');
    topicGrid.innerHTML = data.topics.map(topic => {
        const level = progressService.getCurrentLevel(topic.name);
        const descriptor = getLevelDescriptor(level);
        return `
        <div class="topic-card-flipper" role="group" aria-label="${topic.name}">
            <div class="topic-card-inner">
                <div class="topic-card topic-card-front">
                    <div class="topic-icon">${topic.icon}</div>
                    <h3>${topic.name}</h3>
                    <p>${topic.description}</p>
                    <div class="level-info">
                        <span class="level-display">Level ${level}</span>
                    </div>
                </div>
                <div class="topic-card topic-card-back">
                    <div class="level-info">
                        <span class="level-display">${topic.name} - Level ${level}</span>
                        <span class="level-descriptor">${descriptor}</span>
                    </div>
                    <div class="topic-card-back-actions">
                        <button class="btn btn-secondary study-guide-btn" data-topic="${topic.name}" data-return-hash="${data.returnHash}">Study Guide</button>
                        <button class="btn btn-primary start-quiz-btn" data-topic="${topic.name}" data-return-hash="${data.returnHash}">Start Quiz</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

    document.querySelectorAll('.start-quiz-btn').forEach(button => {
        button.addEventListener('click', handleStartQuiz);
    });
    document.querySelectorAll('.study-guide-btn').forEach(button => {
        button.addEventListener('click', handleStartStudyGuide);
    });
}

function init() {
    const contextString = sessionStorage.getItem('moduleContext');
    const context = contextString ? JSON.parse(contextString) : {};
    if (context.category) {
        renderTopicCards(context.category);
    } else {
        console.error("No category provided to topic-list module.");
        document.getElementById('topic-grid').innerHTML = `<p>Error: No category was selected. Please go back.</p>`;
    }
}

init();