
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as apiService from './apiService.js';

// --- HARDCODED INTEREST DATA (Shared Source of Truth) ---
const INTEREST_DATA = {
    cs: [
        { name: "Python for Beginners", description: "Master the basics of Python, the world's most popular language.", styleClass: "topic-programming", totalLevels: 50 },
        { name: "Ethical Hacking", description: "Learn penetration testing and network defense strategies.", styleClass: "topic-space", totalLevels: 60 },
        { name: "Web Development 101", description: "HTML, CSS, and JavaScript: Build your first website.", styleClass: "topic-arts", totalLevels: 40 },
        { name: "Artificial Intelligence", description: "Understand Neural Networks, ML, and the future of tech.", styleClass: "topic-robotics", totalLevels: 100 }
    ],
    history: [
        { name: "World War II", description: "The global conflict that shaped the modern world.", styleClass: "topic-finance", totalLevels: 80 },
        { name: "Ancient Rome", description: "Rise and fall of the greatest empire in history.", styleClass: "topic-philosophy", totalLevels: 70 },
        { name: "History of Pakistan", description: "From the Indus Valley to independence and beyond.", styleClass: "topic-biology", totalLevels: 50 },
        { name: "The Industrial Revolution", description: "How machines changed human society forever.", styleClass: "topic-programming", totalLevels: 40 }
    ],
    science: [
        { name: "Quantum Physics", description: "Dive into the bizarre world of subatomic particles.", styleClass: "topic-space", totalLevels: 120 },
        { name: "Human Biology", description: "Anatomy, physiology, and the miracle of life.", styleClass: "topic-medicine", totalLevels: 90 },
        { name: "Space Exploration", description: "Rockets, Mars missions, and the search for aliens.", styleClass: "topic-programming", totalLevels: 60 },
        { name: "Organic Chemistry", description: "The carbon-based building blocks of existence.", styleClass: "topic-ecology", totalLevels: 80 }
    ],
    business: [
        { name: "Digital Marketing", description: "SEO, Social Media, and growth hacking strategies.", styleClass: "topic-arts", totalLevels: 50 },
        { name: "Financial Literacy", description: "Investing, saving, and managing personal wealth.", styleClass: "topic-finance", totalLevels: 30 },
        { name: "Entrepreneurship", description: "How to start, fund, and scale your own startup.", styleClass: "topic-robotics", totalLevels: 60 },
        { name: "Stock Market Basics", description: "Understanding bulls, bears, and trading.", styleClass: "topic-programming", totalLevels: 40 }
    ]
};

let gameProgress = [];
const pendingJourneys = new Map();

// --- Interest Persistence Methods ---
export function getUserInterest() {
    return localStorage.getItem('kt_selected_interest');
}

export function saveUserInterest(category) {
    // Allow saving 'custom' or any valid category
    if (category === 'custom' || INTEREST_DATA[category]) {
        localStorage.setItem('kt_selected_interest', category);
    }
}

export function clearUserInterest() {
    localStorage.removeItem('kt_selected_interest');
}

export function getInterestTopics(category) {
    return INTEREST_DATA[category] || [];
}

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
 * Gets an existing journey for a topic or creates a new one by calling the AI if it doesn't exist.
 * @param {string} goal - The user-defined goal for the learning journey (topic name).
 * @param {object} [preCalculatedPlan] - Optional. If provided, uses this plan instead of calling the API.
 * @returns {Promise<object>} A promise that resolves to the existing or newly created journey object.
 * @throws {Error} If API call fails.
 */
export function startOrGetJourney(goal, preCalculatedPlan = null) {
    const existingJourney = getJourneyByGoal(goal);
    if (existingJourney) {
        return Promise.resolve(existingJourney);
    }

    const lowerCaseGoal = goal.toLowerCase();
    
    // If we have a plan already (from the creator UI), create it immediately without API call
    if (preCalculatedPlan) {
        const newJourney = {
            id: `journey_${Date.now()}`,
            goal,
            description: preCalculatedPlan.description,
            currentLevel: 1,
            totalLevels: preCalculatedPlan.totalLevels,
            createdAt: new Date().toISOString(),
        };

        gameProgress.unshift(newJourney);
        saveProgress();
        return Promise.resolve(newJourney);
    }

    // Otherwise, handle standard generation with race-condition protection
    if (pendingJourneys.has(lowerCaseGoal)) {
        return pendingJourneys.get(lowerCaseGoal);
    }

    const journeyPromise = apiService.generateJourneyPlan(goal)
        .then(plan => {
            // Check again in case another request finished while this one was in-flight
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
            pendingJourneys.delete(lowerCaseGoal);
            return newJourney;
        })
        .catch(error => {
            pendingJourneys.delete(lowerCaseGoal);
            throw error; // Re-throw to be handled by the caller
        });

    pendingJourneys.set(lowerCaseGoal, journeyPromise);
    return journeyPromise;
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
