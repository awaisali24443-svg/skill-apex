const PROGRESS_KEY = 'knowledgeTesterUserProgress';

const getDefaultProgress = () => ({
    stats: {
        totalQuizzes: 0,
        totalCorrect: 0,
        xp: 0,
        streak: 0,
        lastQuizDate: null,
    },
    levels: {}
});

/**
 * Checks if two dates are on the same day, ignoring time.
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

/**
 * Loads the entire user progress object from localStorage.
 * @returns {object} The user's progress object, or a default object if none exists.
 */
export const getProgress = () => {
    try {
        const progressString = localStorage.getItem(PROGRESS_KEY);
        if (progressString) {
            // Merge saved progress with default structure to handle future updates
            const savedProgress = JSON.parse(progressString);
            const defaultStructure = getDefaultProgress();
            const progress = {
                stats: { ...defaultStructure.stats, ...savedProgress.stats },
                levels: { ...defaultStructure.levels, ...savedProgress.levels }
            };
            
            // Check and reset streak if necessary
            if (progress.stats.lastQuizDate) {
                const today = new Date();
                const lastDate = new Date(progress.stats.lastQuizDate);
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                if (!isSameDay(today, lastDate) && !isSameDay(yesterday, lastDate)) {
                    progress.stats.streak = 0; // Reset streak if not today or yesterday
                }
            }
            return progress;
        }
        return getDefaultProgress();
    } catch (e) {
        console.error("Could not load user progress:", e);
        return getDefaultProgress();
    }
};

/**
 * Saves the entire user progress object to localStorage.
 * @param {object} progress - The progress object to save.
 */
export const saveProgress = (progress) => {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (e) {
        console.error("Could not save user progress:", e);
    }
};

/**
 * Gets the current unlocked level for a specific topic.
 * @param {string} topic - The topic to check.
 * @returns {number} The current level, defaulting to 1.
 */
export const getCurrentLevel = (topic) => {
    const progress = getProgress();
    return progress.levels[topic] || 1;
};

/**
 * Increments the level for a given topic if it's below the max level.
 * @param {string} topic - The topic to unlock the next level for.
 * @param {number} maxLevel - The maximum level allowed.
 */
export const unlockNextLevel = (topic, maxLevel = 50) => {
    const progress = getProgress();
    const currentLevel = progress.levels[topic] || 1;
    if (currentLevel < maxLevel) {
        progress.levels[topic] = currentLevel + 1;
        progress.stats.xp += 100; // Bonus XP for leveling up
        saveProgress(progress);
    }
};

/**
 * Records the result of a completed quiz, updating stats, XP, and streak.
 * @param {number} score - The number of correct answers.
 * @param {number} numQuestions - The total number of questions in the quiz.
 * @param {number} xpGained - The amount of XP earned from the quiz.
 */
export const recordQuizResult = (score, numQuestions, xpGained) => {
    const progress = getProgress();
    const today = new Date();
    const lastDate = progress.stats.lastQuizDate ? new Date(progress.stats.lastQuizDate) : null;
    
    // Update Streak
    if (lastDate) {
        if (!isSameDay(today, lastDate)) {
             const yesterday = new Date();
             yesterday.setDate(today.getDate() - 1);
             if (isSameDay(yesterday, lastDate)) {
                 progress.stats.streak += 1; // Continued streak
             } else {
                 progress.stats.streak = 1; // Reset streak
             }
        }
    } else {
        progress.stats.streak = 1; // First quiz
    }

    progress.stats.lastQuizDate = today.toISOString();
    
    // Update other stats
    progress.stats.totalQuizzes += 1;
    progress.stats.totalCorrect += score;
    progress.stats.xp += xpGained;
    
    saveProgress(progress);
};

/**
 * Resets all user progress, including stats and levels.
 */
export const resetProgress = () => {
    try {
        localStorage.removeItem(PROGRESS_KEY);
    } catch (e) {
        console.error("Could not reset user progress:", e);
    }
};