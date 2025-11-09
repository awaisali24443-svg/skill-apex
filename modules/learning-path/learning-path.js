import { getLearningPathById } from '../../services/learningPathService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { NUM_QUESTIONS, UNLOCK_SCORE, MODULE_CONTEXT_KEY } from '../../constants.js';
import { initModuleScene, cleanupModuleScene } from '../../services/moduleHelper.js';

let sceneManager;
let currentPathData = null;

function renderPath(pathData) {
    currentPathData = pathData;
    const { title, steps, currentStep } = pathData;

    document.getElementById('path-title').textContent = title;
    const progressPercentage = steps.length > 0 ? (currentStep / steps.length) * 100 : 0;
    document.getElementById('path-progress-bar').style.width = `${progressPercentage}%`;
    
    if (currentStep >= steps.length) {
         document.getElementById('path-progress-text').textContent = `Path Complete!`;
         document.getElementById('path-progress-bar').style.width = `100%`;
    } else {
         document.getElementById('path-progress-text').textContent = `Step ${currentStep + 1} of ${steps.length}`;
    }

    const stepsContainer = document.getElementById('learning-path-steps-container');
    stepsContainer.innerHTML = steps.map((step, index) => {
        let status = 'locked';
        let icon = '🔒';
        if (index < currentStep) {
            status = 'completed';
            icon = '✅';
        } else if (index === currentStep) {
            status = 'current';
            icon = '▶️';
        }
        
        if (currentStep >= steps.length) {
            status = 'completed';
            icon = '✅';
        }

        return `
            <div class="path-step-card ${status}" data-step-index="${index}" data-topic="${step.title}">
                <div class="step-status-icon">${icon}</div>
                <div class="step-info">
                    <h3>${step.title}</h3>
                    <p>${step.description}</p>
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelector('.path-step-card.current')?.addEventListener('click', handleStartStepQuiz);
}

async function handleStartStepQuiz(e) {
    const card = e.currentTarget;
    const topic = card.dataset.topic;
    const stepIndex = parseInt(card.dataset.stepIndex, 10);

    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${topic}". The difficulty should be beginner-friendly as it's part of a learning path. You need a score of ${UNLOCK_SCORE} to pass.`;

    const quizContext = {
        topicName: topic,
        isLeveled: false,
        prompt: prompt,
        returnHash: '#learning-path',
        generationType: 'quiz',
        learningPathInfo: {
            pathId: currentPathData.id,
            stepIndex: stepIndex,
            totalSteps: currentPathData.steps.length
        }
    };
    
    await startQuizFlow(quizContext);
}


export async function init() {
    const contextString = sessionStorage.getItem(MODULE_CONTEXT_KEY);
    const context = contextString ? JSON.parse(contextString) : {};
    const pathId = context.pathId;

    if (!pathId) {
        window.showToast("No learning path selected.", "error");
        window.location.hash = '#home';
        return;
    }
    
    const pathData = await getLearningPathById(pathId);

    if (pathData) {
        renderPath(pathData);
    } else {
        document.getElementById('path-title').textContent = "Path not found";
        document.getElementById('learning-path-steps-container').innerHTML = `<p>Could not load the learning path. It might have been deleted.</p>`;
    }

    sceneManager = initModuleScene('.background-canvas', 'nebula');
}

export function cleanup() {
    sceneManager = cleanupModuleScene(sceneManager);
    currentPathData = null;
}