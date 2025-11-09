import { getCurrentUser } from './authService.js';
import { MAX_LEVEL, UNLOCK_SCORE } from '../constants.js';

const db = firebase.firestore();

// --- Local Cache ---
let userProgressCache = null;

// Function to get the week ID for weekly XP tracking
function getWeekId(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo}`;
}

/**
 * Fetches the user's progress data from Firestore.
 * Caches the result to minimize reads.
 * @param {boolean} forceRefresh - If true, bypasses the cache.
 * @returns {Promise<object|null>}
 */
export async function getProgress(forceRefresh = false) {
    const user = getCurrentUser();
    if (!user) return null;

    if (!forceRefresh && userProgressCache) {
        return userProgressCache;
    }

    try {
        const userDocRef = db.collection('users').doc(user.uid);
        const progressDocRef = userDocRef.collection('progress').doc('main');
        
        const [userDoc, progressDoc] = await Promise.all([userDocRef.get(), progressDocRef.get()]);

        if (!userDoc.exists || !progressDoc.exists) {
            console.warn("User document or progress subcollection not found.");
            return null;
        }

        const progress = {
            ...userDoc.data(),
            ...progressDoc.data()
        };
        
        // Handle weekly XP reset logic
        const currentWeekId = getWeekId(new Date());
        if (progress.lastWeekReset !== currentWeekId) {
            progress.weeklyXP = 0;
            progress.lastWeekReset = currentWeekId;
            // Update Firestore in the background, don't block the UI
            userDocRef.update({ weeklyXP: 0, lastWeekReset: currentWeekId });
        }

        userProgressCache = progress;
        return progress;
    } catch (error) {
        console.error("Error getting user progress:", error);
        return null;
    }
}

/**
 * Calculates level information based on total XP.
 * Using an exponential curve for XP requirements.
 * @param {number} xp - Total experience points.
 * @returns {{level: number, xpForNextLevel: number, currentLevelXP: number, progressPercentage: number}}
 */
export function calculateLevelInfo(xp = 0) {
    const baseXP = 100;
    const exponent = 1.5;
    let level = 1;
    let requiredXP = baseXP;

    while (xp >= requiredXP) {
        xp -= requiredXP;
        level++;
        requiredXP = Math.floor(baseXP * Math.pow(level, exponent));
    }

    const xpForNextLevel = requiredXP;
    const currentLevelXP = xp;
    const progressPercentage = Math.min((currentLevelXP / xpForNextLevel) * 100, 100);

    return { level, xpForNextLevel, currentLevelXP, progressPercentage };
}


/**
 * Updates user progress after a quiz. Uses a transaction for atomicity.
 * @param {object} quizContext - Context of the completed quiz.
 * @param {number} score - Number of correct answers.
 * @param {Array<string>} missedConcepts - Concepts from missed questions.
 * @returns {Promise<{xpGained: number, didLevelUp: boolean, newLevel: number}>}
 */
export async function updateProgressAfterQuiz(quizContext, score, missedConcepts = []) {
    const user = getCurrentUser();
    if (!user) throw new Error("User not authenticated.");

    const xpGained = score * 10; // 10 XP per correct answer
    const { topicName, isLeveled } = quizContext;
    
    const userDocRef = db.collection('users').doc(user.uid);
    const progressDocRef = userDocRef.collection('progress').doc('main');

    let didLevelUp = false;
    let newLevel = 0;

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            const progressDoc = await transaction.get(progressDocRef);
            if (!userDoc.exists || !progressDoc.exists) {
                throw new Error("User progress document not found.");
            }

            const userData = userDoc.data();
            const progressData = progressDoc.data();

            const oldLevelInfo = calculateLevelInfo(userData.xp);
            
            // --- Update main user data ---
            const userUpdate = {};
            userUpdate.xp = (userData.xp || 0) + xpGained;
            userUpdate.weeklyXP = (userData.weeklyXP || 0) + xpGained;
            
            // Daily Streak Logic
            const today = new Date().toISOString().split('T')[0];
            if (userData.lastQuizDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                userUpdate.streak = (userData.lastQuizDate === yesterdayStr) ? (userData.streak || 0) + 1 : 1;
                userUpdate.lastQuizDate = today;
            }

            // --- Update progress subcollection data ---
            const progressUpdate = {};

            // Topic Leveling
            if (isLeveled) {
                const currentLevel = progressData.levels[topicName] || 1;
                if (score >= UNLOCK_SCORE && currentLevel < MAX_LEVEL) {
                    progressUpdate[`levels.${topicName}`] = currentLevel + 1;
                }
            }
            
            // History and missed concepts
            const historyPath = `history.${topicName}`;
            progressUpdate[`${historyPath}.correct`] = firebase.firestore.FieldValue.increment(score);
            progressUpdate[`${historyPath}.incorrect`] = firebase.firestore.FieldValue.increment(5 - score); // Assuming 5 questions
            if (missedConcepts.length > 0) {
                 progressUpdate[`${historyPath}.missedConcepts`] = firebase.firestore.FieldValue.arrayUnion(...missedConcepts);
            }

            transaction.update(userDocRef, userUpdate);
            transaction.update(progressDocRef, progressUpdate);

            // Check for player level up post-transaction
            const newLevelInfo = calculateLevelInfo(userUpdate.xp);
            if (newLevelInfo.level > oldLevelInfo.level) {
                didLevelUp = true;
                newLevel = newLevelInfo.level;
            }
        });

        await getProgress(true); // Force refresh cache

        return { xpGained, didLevelUp, newLevel };
    } catch (error) {
        console.error("Transaction failed: ", error);
        throw new Error("Could not save your progress.");
    }
}


/**
 * Updates generic progress data.
 * @param {object} data - The data to update in the progress subcollection.
 */
export async function updateProgressData(data) {
    const user = getCurrentUser();
    if (!user) return;
    const progressRef = db.collection('users').doc(user.uid).collection('progress').doc('main');
    await progressRef.update(data);
    await getProgress(true); // Refresh cache
}

/**
 * Updates user profile information.
 * @param {object} profileData - The data to update in the main user document.
 */
export async function updateUserProfile(profileData) {
    const user = getCurrentUser();
    if (!user) return;
    const userDocRef = db.collection('users').doc(user.uid);
    await userDocRef.update(profileData);
    await getProgress(true); // Refresh cache
}

/**
 * Resets all progress for the current user.
 */
export async function resetUserProgress() {
    const user = getCurrentUser();
    if (!user) return;
    
    const userDocRef = db.collection('users').doc(user.uid);
    const progressRef = userDocRef.collection('progress').doc('main');
    
    const batch = db.batch();
    
    batch.update(userDocRef, {
        xp: 0,
        weeklyXP: 0,
        streak: 0,
        challengeHighScore: 0,
    });
    
    batch.set(progressRef, {
        levels: {},
        history: {},
        achievements: [],
    });
    
    await batch.commit();
    userProgressCache = null; // Clear cache
}

/**
 * Gets the current level for a specific topic.
 * @param {string} topicName - The name of the topic.
 * @returns {number} The current level (defaults to 1).
 */
export function getCurrentLevel(topicName) {
    return userProgressCache?.levels?.[topicName] || 1;
}

// Invalidate cache on logout
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        userProgressCache = null;
    }
});
