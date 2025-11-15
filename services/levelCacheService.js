import { LOCAL_STORAGE_KEYS } from '../constants.js';

const CACHE_PREFIX = 'kt-level-cache-';

/**
 * Saves generated level data to localStorage.
 * @param {string} topic - The topic of the game.
 * @param {number} level - The level number.
 * @param {object} data - The level data (lesson and questions) to cache.
 */
export function saveLevel(topic, level, data) {
    if (!topic || !level || !data) return;
    try {
        const key = `${CACHE_PREFIX}${topic.toLowerCase()}-${level}`;
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save level to cache. Storage might be full.", e);
    }
}

/**
 * Retrieves cached level data from localStorage.
 * @param {string} topic - The topic of the game.
 * @param {number} level - The level number.
 * @returns {object|null} The cached level data, or null if not found.
 */
export function getLevel(topic, level) {
    if (!topic || !level) return null;
    try {
        const key = `${CACHE_PREFIX}${topic.toLowerCase()}-${level}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error("Failed to retrieve level from cache.", e);
        return null;
    }
}

/**
 * Clears all cached level data from localStorage.
 */
export function clearAllLevels() {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log('All cached levels cleared.');
    } catch (e) {
        console.error("Failed to clear level cache.", e);
    }
}
