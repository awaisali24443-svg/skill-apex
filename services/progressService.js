const PROGRESS_KEY = 'knowledgeTesterUserProgress';

const getDefaultProgress = () => ({
    stats: {
        totalQuizzes: 0,
        totalCorrect: 0,
    },
    levels: {}
});

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
            return {
                stats: { ...getDefaultProgress().stats, ...savedProgress.stats },
                levels: { ...getDefaultProgress().levels, ...savedProgress.levels }
            };
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
        saveProgress(progress);
    }
};

/**
 * Records the result of a completed quiz to update overall stats.
 * @param {number} score - The number of correct answers.
 * @param {number} numQuestions - The total number of questions in the quiz.
 */
export const recordQuizResult = (score, numQuestions) => {
    const progress = getProgress();
    progress.stats.totalQuizzes += 1;
    progress.stats.totalCorrect += score;
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