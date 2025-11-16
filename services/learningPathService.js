import { LOCAL_STORAGE_KEYS } from '../constants.js';

let gameProgress = [];
const TOTAL_LEVELS = 500;

/**
 * Loads game progress from localStorage.
 * @private
 */
function loadProgress() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS);
        gameProgress = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load game progress:", e);
        gameProgress = [];
    }
}

/**
 * Saves the current game progress to localStorage.
 * @private
 */
function saveProgress() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(gameProgress));
    } catch (e) {
        console.error("Failed to save game progress:", e);
    }
}

/**
 * Initializes the service by loading data from localStorage.
 * Should be called once on application startup.
 */
export function init() {
    loadProgress();
}

/**
 * Retrieves all saved game journeys.
 * @returns {Array<object>} An array of journey objects.
 */
export function getAllJourneys() {
    return gameProgress;
}

/**
 * Finds a specific journey by its ID.
 * @param {string} id - The ID of the journey.
 * @returns {object|undefined} The found journey object, or undefined.
 */
export function getJourneyById(id) {
    return gameProgress.find(p => p.id === id);
}

/**
 * Finds a specific journey by its goal (case-insensitive).
 * @param {string} goal - The goal of the journey (topic name).
 * @returns {object|undefined} The found journey object, or undefined.
 */
export function getJourneyByGoal(goal) {
    if (!goal) return undefined;
    const lowerCaseGoal = goal.toLowerCase();
    return gameProgress.find(p => p.goal.toLowerCase() === lowerCaseGoal);
}

/**
 * Gets an existing journey for a topic or creates a new one if it doesn't exist.
 * @param {string} goal - The user-defined goal for the learning journey (topic name).
 * @returns {object} The existing or newly created journey object.
 */
export function startOrGetJourney(goal) {
    let journey = getJourneyByGoal(goal);
    if (journey) {
        // Ensure existing journeys are updated to the new total levels
        if (journey.totalLevels !== TOTAL_LEVELS) {
            journey.totalLevels = TOTAL_LEVELS;
            saveProgress();
        }
        return journey;
    }
    
    const newJourney = {
        id: `journey_${Date.now()}`,
        goal,
        currentLevel: 1,
        totalLevels: TOTAL_LEVELS,
        createdAt: new Date().toISOString(),
    };
    gameProgress.unshift(newJourney); // Add to the beginning for chronological display
    saveProgress();
    return newJourney;
}

/**
 * Advances the user's progress in a journey to the next level.
 * @param {string} journeyId - The ID of the journey to update.
 */
export function completeLevel(journeyId) {
    const journey = getJourneyById(journeyId);
    if (journey && journey.currentLevel <= journey.totalLevels) {
        journey.currentLevel += 1;
        saveProgress();
    }
}

/**
 * Deletes a journey from storage.
 * @param {string} journeyId - The ID of the journey to delete.
 */
export function deleteJourney(journeyId) {
    gameProgress = gameProgress.filter(p => p.id !== journeyId);
    saveProgress();
}
