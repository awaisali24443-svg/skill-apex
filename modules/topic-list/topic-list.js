import * as progressService from '../../services/progressService.js';
import { NUM_QUESTIONS, MAX_LEVEL, MODULE_CONTEXT_KEY } from '../../constants.js';
import { categoryData } from '../../services/topicService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;

const levelDescriptors = {
    1: "Novice", 5: "Apprentice", 10: "Journeyman", 15: "Adept", 20: "Expert",
    25: "Master", 30: "Grandmaster", 40: "Legend", 50: "Mythic"
};

function getLevelDescriptor(level) {
    let descriptor = "Novice";
    for (const threshold in levelDescriptors) {
        if (level >= threshold) {
            descriptor = levelDescriptors[threshold];
        }
    }
    return descriptor;
}

function renderTopicCard(topic, level = 1) {
    const descriptor = getLevelDescriptor(level);
    return `
        <div class="topic-card-flipper" role="button" tabindex="0" aria-label="Select topic: ${topic.name}">
            <div class="topic-card-inner">
                <div class="topic-card topic-card-front">
                    <div class="topic-icon">${topic.icon}</div>
                    <h3>${topic.name}</h3>
                    <p>${topic.description}</p>
                </div>
                <div class="topic-card topic-card-back">
                    <div class="level-info">
                        <div class="level-display">LVL ${level}</div>
                        <span class="level-descriptor">${descriptor}</span>
                    </div>
                    <div class="topic-card-back-actions">
                         <button class="btn btn-secondary start-study-btn" data-topic-name="${topic.name}" data-level="${level}">Study Guide</button>
                        <button class="btn btn-primary start-quiz-btn" data-topic-name="${topic.name}" data-level="${level}">Start Quiz</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachCardListeners() {
    document.querySelectorAll('.start-quiz-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const topicName = e.target.dataset.topicName;
            const level = parseInt(e.target.dataset.level, 10);
            const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topicName}". The difficulty should be appropriate for a user at Level ${level} of ${MAX_LEVEL}.`;
            const quizContext = { topicName, level, returnHash: window.location.hash, isLeveled: true, prompt, generationType: 'quiz' };
            await startQuizFlow(quizContext);
        });
    });

    document.querySelectorAll('.start-study-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const topicName = e.target.dataset.topicName;
            const prompt = `Generate a concise study guide about "${topicName}". The guide should be easy to understand for a beginner, using clear headings, bullet points, and bold text for key terms.`;
            const quizContext = { topicName, returnHash: window.location.hash, isLeveled: true, prompt, generationType: 'study' };
            await startQuizFlow(quizContext);
        });
    });
}

export async function init() {
    const contextString = sessionStorage.getItem(MODULE_CONTEXT_KEY);
    const context = contextString ? JSON.parse(contextString) : {};
    const categoryKey = context.category;

    if (!categoryKey || !categoryData[categoryKey]) {
        document.getElementById('root-container').innerHTML = `<h2>Category not found</h2>`;
        return;
    }

    const category = categoryData[categoryKey];
    document.getElementById('category-title').textContent = category.title;
    document.getElementById('category-subtitle').textContent = category.subtitle;

    const progress = await progressService.getProgress();
    const topicGrid = document.getElementById('topic-grid');
    topicGrid.innerHTML = category.topics.map(topic => {
        const level = progress?.levels?.[topic.name] || 1;
        return renderTopicCard(topic, level);
    }).join('');

    attachCardListeners();
    sceneManager = initModuleScene('.background-canvas', 'atomicStructure');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
}