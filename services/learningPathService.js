
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as apiService from './apiService.js';
import * as gamificationService from './gamificationService.js'; // Added import
import { db, doc, getDoc, setDoc, getUserId, isGuest } from './firebaseService.js';

// ... INTEREST_DATA and variables ...

export function startOrGetJourney(goal, preCalculatedPlan = null) {
    const existingJourney = getJourneyByGoal(goal);
    if (existingJourney) {
        return Promise.resolve(existingJourney);
    }

    const lowerCaseGoal = goal.toLowerCase();
    
    if (preCalculatedPlan) {
        const newJourney = {
            id: `journey_${Date.now()}`,
            goal,
            description: preCalculatedPlan.description,
            currentLevel: 1,
            totalLevels: preCalculatedPlan.totalLevels,
            styleClass: preCalculatedPlan.styleClass || null, 
            createdAt: new Date().toISOString(),
        };

        gameProgress.unshift(newJourney);
        saveProgress();
        // NEW: Track Stat
        gamificationService.incrementStat('journeysStarted', 1);
        return Promise.resolve(newJourney);
    }

    if (pendingJourneys.has(lowerCaseGoal)) {
        return pendingJourneys.get(lowerCaseGoal);
    }

    const journeyPromise = apiService.generateJourneyPlan(goal)
        .then(plan => {
            const nowExistingJourney = getJourneyByGoal(goal);
            if (nowExistingJourney) {
                pendingJourneys.delete(lowerCaseGoal);
                return nowExistingJourney;
            }

            const newJourney = {
                id: `journey_${Date.now()}`,
                goal,
                description: plan.description,
                currentLevel: 1,
                totalLevels: plan.totalLevels,
                createdAt: new Date().toISOString(),
            };

            gameProgress.unshift(newJourney);
            saveProgress();
            // NEW: Track Stat
            gamificationService.incrementStat('journeysStarted', 1);
            pendingJourneys.delete(lowerCaseGoal);
            return newJourney;
        })
        .catch(error => {
            pendingJourneys.delete(lowerCaseGoal);
            throw error;
        });

    pendingJourneys.set(lowerCaseGoal, journeyPromise);
    return journeyPromise;
}

// ... rest of code ...
