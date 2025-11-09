import { getProgress, calculateLevelInfo, findWeakestTopic } from '../../services/progressService.js';
import { getActiveMissions } from '../../services/missionService.js';
import { StellarMap } from '../../services/stellarMap.js';
import { getCurrentUser } from '../../services/authService.js';
import { generateAICoachSuggestion } from '../../services/geminiService.js';
import { startQuizFlow } from '../../services/navigationService.js';
import { NUM_QUESTIONS } from '../../constants.js';

let stellarMap;

async function displayDailyMissions() {
    const container = document.getElementById('daily-missions-container');
    if (!container) return;
    const missions = await getActiveMissions(); // Now async
    
    if (!missions || missions.length === 0) {
        container.innerHTML = '<p>No active missions. Check back tomorrow!</p>';
        return;
    }

    let html = missions.map(mission => `
        <div class="mission-card ${mission.isComplete ? 'completed' : ''}">
            <p class="mission-title">${mission.description}</p>
            <p class="mission-reward">+${mission.reward} XP</p>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function updatePlayerStats() {
    const user = getCurrentUser();
    if (!user) return;

    const progress = await getProgress(); // Now async
    if (!progress) {
        // Handle case where user doc might not be fully created yet
        document.getElementById('player-name').textContent = `Welcome, Agent!`;
        return;
    }

    const { level, currentXP, nextLevelXP, percentage } = calculateLevelInfo(progress.xp);
    
    document.getElementById('player-name').textContent = `Agent, ${progress.username || 'Welcome Back'}`;
    document.getElementById('player-level').textContent = `LVL ${level}`;
    document.getElementById('xp-progress-text').textContent = `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()} XP`;
    document.getElementById('xp-progress-bar').style.width = `${percentage}%`;
}

async function displayAICoachSuggestion() {
    const container = document.getElementById('ai-coach-container');
    if (!container) return;

    try {
        const progress = await getProgress();
        if (!progress) throw new Error("Could not load progress.");

        const weakestTopic = findWeakestTopic(progress);

        let suggestion;
        if (weakestTopic) {
            suggestion = await generateAICoachSuggestion(weakestTopic, progress.username);
        } else {
            // Default message if no weak topic is found
            suggestion = {
                title: "You're Doing Great!",
                message: "We couldn't find a specific weak spot to target. Keep exploring new topics in the Topic Universe to expand your knowledge!",
                action: {
                    type: "explore",
                    label: "Explore Topic Universe",
                    topic: null
                }
            };
        }

        container.innerHTML = `
            <h3 class="ai-coach-title">${suggestion.title}</h3>
            <p class="ai-coach-message">${suggestion.message}</p>
            <div class="ai-coach-action">
                <button id="ai-coach-action-btn" class="btn btn-primary">${suggestion.action.label}</button>
            </div>
        `;
        
        const actionBtn = document.getElementById('ai-coach-action-btn');
        if (actionBtn) {
            actionBtn.addEventListener('click', async () => {
                if (suggestion.action.type === 'quiz') {
                    const prompt = `Generate a quiz with ${NUM_QUESTIONS} multiple-choice questions about "${suggestion.action.topic}". This is a refresher quiz targeting a user's weak area.`;
                    const quizContext = {
                        topicName: suggestion.action.topic,
                        isLeveled: false,
                        prompt: prompt,
                        returnHash: '#home',
                        generationType: 'quiz'
                    };
                    await startQuizFlow(quizContext);
                } else if (suggestion.action.type === 'study') {
                     const prompt = `Generate a concise study guide about "${suggestion.action.topic}". The guide should be easy to understand for a beginner.`;
                     const quizContext = {
                         topicName: suggestion.action.topic,
                         isLeveled: false,
                         returnHash: '#home',
                         prompt: prompt,
                         generationType: 'study'
                     };
                     sessionStorage.setItem('quizContext', JSON.stringify(quizContext));
                     window.location.hash = '#loading';
                } else { // 'explore'
                    document.getElementById('stellar-map-container')?.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

    } catch (error) {
        console.error("AI Coach Error:", error);
        container.innerHTML = `
            <h3 class="ai-coach-title">Coach is Resting</h3>
            <p class="ai-coach-message">Could not generate a suggestion right now. Keep up the great work!</p>
        `;
    }
}


function cleanup() {
    if (stellarMap) {
        stellarMap.destroy();
        stellarMap = null;
    }
}

async function init() {
    await updatePlayerStats();
    await displayDailyMissions();
    displayAICoachSuggestion();
    
    // Defer scene initialization to improve perceived performance
    setTimeout(() => {
        const canvas = document.getElementById('stellar-map-canvas');
        if (canvas && window.THREE) {
            stellarMap = new StellarMap(canvas);
            stellarMap.init();
        }
    }, 100);
}

const observer = new MutationObserver((mutationsList, obs) => {
    for(const mutation of mutationsList) {
        if (mutation.type === 'childList' && !document.querySelector('.mission-control-container')) {
            cleanup();
            obs.disconnect();
            return;
        }
    }
});
observer.observe(document.getElementById('root-container'), { childList: true });

init();