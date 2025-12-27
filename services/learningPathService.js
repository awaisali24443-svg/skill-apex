import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as apiService from './apiService.js';
import * as firebaseService from './firebaseService.js';

let gameProgress = [];

async function loadProgress() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS);
        if (stored) gameProgress = JSON.parse(stored);
        
        const remote = await firebaseService.fetchUserData('journeys');
        if (remote && remote.items) {
            gameProgress = remote.items;
            localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(gameProgress));
        }
        window.dispatchEvent(new CustomEvent('journeys-updated'));
    } catch (e) {}
}

function saveProgress() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(gameProgress));
    firebaseService.saveUserData('journeys', { items: gameProgress });
    window.dispatchEvent(new CustomEvent('journeys-updated'));
}

export function init() { loadProgress(); }
export function getAllJourneys() { return gameProgress; }
export function getJourneyById(id) { return gameProgress.find(p => p.id === id); }
export function getJourneyByGoal(goal) { return gameProgress.find(p => p.goal.toLowerCase() === goal.toLowerCase()); }

export async function startOrGetJourney(goal, preCalculatedPlan = null) {
    const existing = getJourneyByGoal(goal);
    if (existing) return existing;

    const plan = preCalculatedPlan || await apiService.generateJourneyPlan(goal);
    const newJourney = {
        id: `journey_${Date.now()}`,
        goal,
        description: plan.description,
        currentLevel: 1,
        totalLevels: plan.totalLevels,
        styleClass: plan.styleClass || 'topic-programming',
        createdAt: new Date().toISOString(),
    };
    gameProgress.unshift(newJourney);
    saveProgress();
    return newJourney;
}

export function completeLevel(journeyId) {
    const journey = getJourneyById(journeyId);
    if (journey && journey.currentLevel <= journey.totalLevels) {
        journey.currentLevel += 1;
        saveProgress();
    }
}

export function deleteJourney(journeyId) {
    gameProgress = gameProgress.filter(p => p.id !== journeyId);
    saveProgress();
}
