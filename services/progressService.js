const PROGRESS_KEY = 'knowledgeTesterUserProgress';

/**
 * Loads the entire user progress object from localStorage.
 * @returns {object} The user's progress object, or an empty object if none exists.
 */
export const getProgress = () => {
    try {
        const progressString = localStorage.getItem(PROGRESS_KEY);
        return progressString ? JSON.parse(progressString) : {};
    } catch (e) {
        console.error("Could not load user progress:", e);
        return {};
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
    return progress[topic] || 1;
};

/**
 * Increments the level for a given topic if it's below the max level.
 * @param {string} topic - The topic to unlock the next level for.
 * @param {number} maxLevel - The maximum level allowed.
 */
export const unlockNextLevel = (topic, maxLevel = 50) => {
    const progress = getProgress();
    const currentLevel = progress[topic] || 1;
    if (currentLevel < maxLevel) {
        progress[topic] = currentLevel + 1;
        saveProgress(progress);
    }
};
