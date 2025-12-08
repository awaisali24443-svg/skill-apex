
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as apiService from './apiService.js';
import * as gamificationService from './gamificationService.js';
import { db, doc, getDoc, setDoc, getUserId, isGuest } from './firebaseService.js';

let gameProgress = [];
let userInterest = null;
const pendingJourneys = new Map();

// Default curriculum data for onboarding interests
const INTEREST_DATA = {
    cs: [
        { name: "Python for Beginners", description: "Master the basics of Python programming, variables, and loops.", totalLevels: 30, styleClass: "topic-programming" },
        { name: "Web Development 101", description: "Build websites with HTML, CSS, and JavaScript.", totalLevels: 40, styleClass: "topic-programming" },
        { name: "Data Structures & Algos", description: "Essential computer science fundamentals.", totalLevels: 50, styleClass: "topic-programming" }
    ],
    history: [
        { name: "World War II", description: "A comprehensive look at the global conflict.", totalLevels: 40, styleClass: "topic-history" },
        { name: "Ancient Rome", description: "The rise and fall of the Roman Empire.", totalLevels: 30, styleClass: "topic-history" },
        { name: "The Renaissance", description: "The rebirth of art, science, and culture.", totalLevels: 20, styleClass: "topic-history" }
    ],
    science: [
        { name: "Quantum Physics", description: "Understanding the subatomic world.", totalLevels: 50, styleClass: "topic-science" },
        { name: "Human Biology", description: "Anatomy and physiological systems.", totalLevels: 40, styleClass: "topic-medicine" },
        { name: "Astronomy", description: "Stars, galaxies, and the cosmos.", totalLevels: 30, styleClass: "topic-space" }
    ],
    business: [
        { name: "Digital Marketing", description: "SEO, social media, and ad strategies.", totalLevels: 30, styleClass: "topic-finance" },
        { name: "Entrepreneurship", description: "From idea to IPO: Building a business.", totalLevels: 40, styleClass: "topic-finance" },
        { name: "Financial Literacy", description: "Investing, budgeting, and personal finance.", totalLevels: 20, styleClass: "topic-finance" }
    ]
};

/**
 * Initializes the Learning Path Service.
 * Loads local data and syncs with cloud if available.
 */
export async function init() {
    try {
        // 1. Load Local Data
        const storedProgress = localStorage.getItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS);
        if (storedProgress) {
            gameProgress = JSON.parse(storedProgress);
        }

        const storedInterest = localStorage.getItem('knowledge-tester-interest');
        if (storedInterest) {
            userInterest = storedInterest;
        }

        // 2. Cloud Sync (if online and authenticated)
        if (navigator.onLine && !isGuest()) {
            const userId = getUserId();
            if (userId) {
                const docRef = doc(db, "users", userId, "data", "learningPath");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Merge strategy: If cloud has data and local is empty/stale, use cloud.
                    if (data.gameProgress && (!gameProgress.length || data.gameProgress.length >= gameProgress.length)) {
                        gameProgress = data.gameProgress;
                        userInterest = data.userInterest || userInterest;
                        saveProgressLocal(); // Update local to match cloud
                        window.dispatchEvent(new CustomEvent('journeys-updated'));
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to init learning path service:", e);
        // Fallback to empty state to prevent app crash
        gameProgress = [];
    }
}

function saveProgress() {
    saveProgressLocal();
    saveProgressRemote();
    window.dispatchEvent(new CustomEvent('journeys-updated'));
}

function saveProgressLocal() {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.GAME_PROGRESS, JSON.stringify(gameProgress));
        if (userInterest) {
            localStorage.setItem('knowledge-tester-interest', userInterest);
        } else {
            localStorage.removeItem('knowledge-tester-interest');
        }
    } catch (e) {
        console.error("Local save failed:", e);
    }
}

async function saveProgressRemote() {
    if (!navigator.onLine || isGuest()) return;
    try {
        const userId = getUserId();
        if (userId) {
            await setDoc(doc(db, "users", userId, "data", "learningPath"), {
                gameProgress,
                userInterest,
                lastUpdated: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("Cloud save failed:", e);
    }
}

export function getAllJourneys() {
    return [...gameProgress];
}

export function getJourneyById(id) {
    return gameProgress.find(j => j.id === id);
}

export function getJourneyByGoal(goal) {
    if (!goal) return null;
    return gameProgress.find(j => j.goal.toLowerCase() === goal.toLowerCase());
}

export function startOrGetJourney(goal, preCalculatedPlan = null) {
    const existingJourney = getJourneyByGoal(goal);
    if (existingJourney) {
        return Promise.resolve(existingJourney);
    }

    const lowerCaseGoal = goal.toLowerCase();
    
    // Check if a request is already in flight for this goal
    if (pendingJourneys.has(lowerCaseGoal)) {
        return pendingJourneys.get(lowerCaseGoal);
    }

    // Immediate creation if plan is provided (e.g. from preset)
    if (preCalculatedPlan) {
        const newJourney = {
            id: `journey_${Date.now()}`,
            goal,
            description: preCalculatedPlan.description,
            currentLevel: 1,
            totalLevels: preCalculatedPlan.totalLevels,
            styleClass: preCalculatedPlan.styleClass || null, 
            createdAt: new Date().toISOString(),
            lastPlayed: new Date().toISOString()
        };

        gameProgress.unshift(newJourney);
        saveProgress();
        gamificationService.incrementStat('journeysStarted', 1);
        return Promise.resolve(newJourney);
    }

    // Otherwise generate via API
    const journeyPromise = apiService.generateJourneyPlan(goal)
        .then(plan => {
            // Re-check existence in case of race condition
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
                lastPlayed: new Date().toISOString()
            };

            gameProgress.unshift(newJourney);
            saveProgress();
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

export function completeLevel(journeyId) {
    const journey = gameProgress.find(j => j.id === journeyId);
    if (journey && journey.currentLevel <= journey.totalLevels) {
        journey.currentLevel++;
        journey.lastPlayed = new Date().toISOString();
        saveProgress();
    }
}

export function saveUserInterest(category) {
    userInterest = category;
    saveProgress();
}

export function getUserInterest() {
    return userInterest;
}

export function clearUserInterest() {
    userInterest = null;
    saveProgress();
}

export function getInterestTopics(category) {
    if (!category || category === 'custom') return [];
    return INTEREST_DATA[category] || [];
}
