// services/missionService.js
import { categoryData } from './topicService.js';

const MISSIONS_KEY = 'knowledgeTesterDailyMissions';

const MISSION_TEMPLATES = [
    { type: 'complete_category', description: 'Complete a quiz in the {category} category.', reward: 100 },
    { type: 'score_above', description: 'Get a score of 80% or higher in any quiz.', reward: 75 },
    { type: 'perfect_score', description: 'Get a perfect score in any quiz.', reward: 150 },
    { type: 'try_new_topic', description: 'Try a quiz on a topic you haven\'t played before.', reward: 50 },
];

function generateNewMissions() {
    const allCategories = Object.values(categoryData).map(c => c.categoryTitle);
    const selectedTemplates = [];
    const missions = [];

    // Simple shuffle and pick 3 unique templates
    const shuffledTemplates = [...MISSION_TEMPLATES].sort(() => 0.5 - Math.random());
    
    for (const template of shuffledTemplates) {
        if (missions.length >= 3) break;
        
        let mission = { ...template, id: missions.length, isComplete: false };
        
        if (template.type === 'complete_category') {
            const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
            mission.description = template.description.replace('{category}', randomCategory);
            mission.target = randomCategory;
        }

        missions.push(mission);
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const missionState = { date: today, missions: missions };
    
    try {
        localStorage.setItem(MISSIONS_KEY, JSON.stringify(missionState));
    } catch(e) { console.error("Could not save missions:", e); }
    
    return missions;
}

export function getActiveMissions() {
    try {
        const stored = localStorage.getItem(MISSIONS_KEY);
        if (stored) {
            const missionState = JSON.parse(stored);
            const today = new Date().toISOString().split('T')[0];
            if (missionState.date === today) {
                return missionState.missions;
            }
        }
    } catch(e) {
        console.error("Could not load missions:", e);
    }
    // If no stored missions or date is old, generate new ones
    return generateNewMissions();
}

// This function is called from the results screen to check if a mission was completed.
export function checkAndCompleteMissions(quizContext, score, scorePercentage) {
    const missionState = JSON.parse(localStorage.getItem(MISSIONS_KEY) || '{}');
    if (!missionState.missions) return [];

    const completedMissions = [];
    
    missionState.missions.forEach(mission => {
        if (mission.isComplete) return;

        let wasCompleted = false;
        switch (mission.type) {
            case 'complete_category':
                // Find which category the topic belongs to
                const topicCategory = Object.values(categoryData).find(cat => 
                    cat.topics.some(t => t.name === quizContext.topicName)
                )?.categoryTitle;

                if (topicCategory === mission.target) {
                    wasCompleted = true;
                }
                break;
            case 'score_above':
                if (scorePercentage >= 80) {
                    wasCompleted = true;
                }
                break;
            case 'perfect_score':
                if (scorePercentage === 100) {
                    wasCompleted = true;
                }
                break;
            case 'try_new_topic':
                // This is a simplified check. A more robust implementation would check progressService.
                if (quizContext.level === 1) { // Assume level 1 means it's a new topic
                    wasCompleted = true;
                }
                break;
        }

        if (wasCompleted) {
            mission.isComplete = true;
            completedMissions.push(mission);
            window.showToast(`🚀 Mission Complete: ${mission.description}`, 'success');
        }
    });

    if (completedMissions.length > 0) {
        try {
            localStorage.setItem(MISSIONS_KEY, JSON.stringify(missionState));
        } catch(e) { console.error("Could not update missions:", e); }
    }
    
    return completedMissions;
}
