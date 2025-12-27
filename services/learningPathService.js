
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

/**
 * Starts a journey. 
 * If preCalculatedPlan includes 'currentLevel', we jump-start the user (Calibration result).
 */
export async function startOrGetJourney(goal, preCalculatedPlan = null) {
    const existing = getJourneyByGoal(goal);
    
    // CASE 1: Journey exists, but we just did a calibration/interview
    if (existing && preCalculatedPlan && preCalculatedPlan.currentLevel) {
        // If the new assessed level is higher than their current progress, bump them up.
        // We don't downgrade them (that feels bad).
        if (preCalculatedPlan.currentLevel > existing.currentLevel) {
            existing.currentLevel = preCalculatedPlan.currentLevel;
            existing.description = preCalculatedPlan.description || existing.description;
            saveProgress();
        }
        return existing;
    }

    // CASE 2: Standard existing journey return
    if (existing) return existing;

    // CASE 3: New Journey
    const plan = preCalculatedPlan || await apiService.generateJourneyPlan(goal);
    
    const newJourney = {
        id: `journey_${Date.now()}`,
        goal,
        description: plan.description,
        // Use the calibrated level if provided, otherwise start at 1
        currentLevel: plan.currentLevel || 1, 
        totalLevels: plan.totalLevels || 100, // Ensure default
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
