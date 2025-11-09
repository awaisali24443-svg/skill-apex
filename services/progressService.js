import { getCurrentUser } from './authService.js';

const db = firebase.firestore();

// --- GAMIFICATION: Leveling Curve (remains synchronous) ---
const getXPForLevel = (level) => {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level - 1, 1.5));
};

export const calculateLevelInfo = (totalXP) => {
    let level = 1;
    while (totalXP >= getXPForLevel(level + 1)) {
        level++;
    }
    const xpForCurrentLevel = getXPForLevel(level);
    const xpForNextLevel = getXPForLevel(level + 1);
    
    const currentXPInLevel = totalXP - xpForCurrentLevel;
    const nextLevelXPInLevel = xpForNextLevel - xpForCurrentLevel;
    const percentage = nextLevelXPInLevel > 0 ? (currentXPInLevel / nextLevelXPInLevel) * 100 : 100;

    return { level, currentXP: currentXPInLevel, nextLevelXP: nextLevelXPInLevel, percentage };
};
// --- END GAMIFICATION ---

const getWeekId = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo}`;
};

const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

/**
 * Finds the user's weakest topic based on quiz history.
 * A weak topic has at least 5 questions answered and the lowest correct ratio.
 * @param {object} progress - The user's progress object.
 * @returns {string|null} The name of the weakest topic, or null if none is found.
 */
export function findWeakestTopic(progress) {
    if (!progress || !progress.history) {
        return null;
    }

    let weakestTopic = null;
    let lowestRatio = 1.1; // Start above 1.0

    for (const topic in progress.history) {
        const { correct, incorrect } = progress.history[topic];
        const total = correct + incorrect;

        if (total >= 5) { // Must have at least 5 attempts
            const ratio = correct / total;
            if (ratio < lowestRatio) {
                lowestRatio = ratio;
                weakestTopic = topic;
            }
        }
    }

    return weakestTopic;
}


/**
 * Fetches the complete progress document for the current user from Firestore.
 * @returns {Promise<object|null>}
 */
export async function getProgress() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const userDocRef = db.collection('users').doc(user.uid);
        const progressDocRef = userDocRef.collection('progress').doc('main');

        const [userDoc, progressDoc] = await Promise.all([
            userDocRef.get(),
            progressDocRef.get()
        ]);

        if (!userDoc.exists || !progressDoc.exists) {
            console.warn("User or progress document not found.");
            return null;
        }

        const progressData = progressDoc.data();
        const userData = userDoc.data();

        // Combine top-level stats with detailed progress
        const combinedProgress = {
            ...userData, // includes xp, weeklyXP, streak etc.
            ...progressData, // includes levels, history, achievements
        };

        // Live check for weekly reset
        const currentWeekId = getWeekId(new Date());
        if (combinedProgress.lastWeekReset !== currentWeekId) {
            combinedProgress.weeklyXP = 0;
            // We'll update this in Firestore upon the next save.
        }

        // Live check for streak reset
        if (combinedProgress.lastQuizDate) {
            const today = new Date();
            const lastDate = combinedProgress.lastQuizDate.toDate(); // Firestore timestamp to Date
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            if (!isSameDay(today, lastDate) && !isSameDay(yesterday, lastDate)) {
                combinedProgress.streak = 0;
            }
        }
        
        return combinedProgress;

    } catch (error) {
        console.error("Error fetching user progress:", error);
        window.showToast("Could not load your progress.", "error");
        return null;
    }
}

export async function getCurrentLevel(topic) {
    const progress = await getProgress();
    return progress?.levels?.[topic] || 1;
}

export async function recordQuizResult(topic, score, quizData, userAnswers, xpGained) {
    const user = getCurrentUser();
    if (!user) return null;

    const userDocRef = db.collection('users').doc(user.uid);
    const progressDocRef = userDocRef.collection('progress').doc('main');
    
    try {
        await db.runTransaction(async (transaction) => {
            const [userDoc, progressDoc] = await Promise.all([
                transaction.get(userDocRef),
                transaction.get(progressDocRef)
            ]);
            
            if (!userDoc.exists || !progressDoc.exists) {
                throw "Document does not exist!";
            }
            
            const userData = userDoc.data();
            const progressData = progressDoc.data();
            
            // --- Update Streak ---
            const today = new Date();
            let newStreak = userData.streak || 0;
            const lastDate = userData.lastQuizDate ? userData.lastQuizDate.toDate() : null;

            if (lastDate) {
                if (!isSameDay(today, lastDate)) {
                    const yesterday = new Date();
                    yesterday.setDate(today.getDate() - 1);
                    newStreak = isSameDay(yesterday, lastDate) ? newStreak + 1 : 1;
                }
            } else {
                newStreak = 1;
            }

            // --- Update Topic History ---
            if (topic && quizData) {
                const history = progressData.history[topic] || { correct: 0, incorrect: 0, missedConcepts: [] };
                history.correct += score;
                history.incorrect += (quizData.length - score);

                for(let i=0; i < quizData.length; i++) {
                    if (userAnswers[i] !== quizData[i].correctAnswerIndex) {
                        history.missedConcepts.push(quizData[i].explanation);
                    }
                }
                if (history.missedConcepts.length > 20) {
                    history.missedConcepts.splice(0, history.missedConcepts.length - 20);
                }
                progressData.history[topic] = history;
            }
            
             // --- Update Topic Level ---
            if (quizContext.isLeveled && score >= UNLOCK_SCORE) {
                const currentLevel = progressData.levels[quizContext.topicName] || 1;
                if (currentLevel < MAX_LEVEL) {
                    progressData.levels[quizContext.topicName] = currentLevel + 1;
                }
            }


            // --- Prepare User Doc Updates ---
            const newWeeklyXP = (getWeekId(new Date()) === userData.lastWeekReset) ? (userData.weeklyXP || 0) + xpGained : xpGained;

            transaction.update(userDocRef, {
                xp: firebase.firestore.FieldValue.increment(xpGained),
                weeklyXP: newWeeklyXP,
                lastWeekReset: getWeekId(new Date()),
                streak: newStreak,
                lastQuizDate: firebase.firestore.Timestamp.fromDate(today),
            });
            
            // --- Prepare Progress Doc Updates ---
            transaction.update(progressDocRef, {
                history: progressData.history,
                levels: progressData.levels
            });
        });

        // Return the fresh data after transaction
        return await getProgress();

    } catch (error) {
        console.error("Transaction failed: ", error);
        window.showToast("Failed to save your progress.", "error");
        return null;
    }
}

/**
 * Updates data in the user's main progress subdocument.
 * @param {object} dataToUpdate - An object containing fields to update.
 */
export async function updateProgressData(dataToUpdate) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const progressDocRef = db.collection('users').doc(user.uid).collection('progress').doc('main');
        await progressDocRef.update(dataToUpdate);
    } catch (error) {
        console.error("Error updating progress data:", error);
        window.showToast("Failed to save updates.", "error");
        throw error;
    }
}


/**
 * Updates the user's profile information in Firestore.
 * @param {object} profileData - The data to update (e.g., { username, bio, pictureURL }).
 * @returns {Promise<void>}
 */
export async function updateUserProfile(profileData) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const userDocRef = db.collection('users').doc(user.uid);
        await userDocRef.update(profileData);
    } catch (error) {
        console.error("Error updating user profile:", error);
        window.showToast("Failed to update profile.", "error");
        throw error;
    }
}

/**
 * Resets all progress for the current user in Firestore.
 * This is a destructive action.
 * @returns {Promise<void>}
 */
export async function resetUserProgress() {
    const user = getCurrentUser();
    if (!user) return;
    
    const userDocRef = db.collection('users').doc(user.uid);
    const progressDocRef = userDocRef.collection('progress').doc('main');

    try {
        // Reset top-level stats
        await userDocRef.update({
            xp: 0,
            weeklyXP: 0,
            streak: 0,
            lastQuizDate: null,
            challengeHighScore: 0,
        });
        
        // Reset detailed progress
        await progressDocRef.set({
            levels: {},
            history: {},
            achievements: [],
        });
    } catch (error) {
        console.error("Error resetting user progress:", error);
        window.showToast("Failed to reset progress.", "error");
        throw error;
    }
}