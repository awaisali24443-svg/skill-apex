
import { LOCAL_STORAGE_KEYS } from '../constants.js';

const CACHE_PREFIX = 'kt-level-cache-';
const MAX_CACHE_SIZE = 20; // Limit to 20 levels to prevent localStorage quota errors

/**
 * Saves generated level data to localStorage with LRU eviction policy.
 * @param {string} topic - The topic of the game.
 * @param {number} level - The level number.
 * @param {object} data - The level data (lesson and questions) to cache.
 */
export function saveLevel(topic, level, data) {
    if (!topic || !level || !data) return;
    try {
        const key = `${CACHE_PREFIX}${topic.toLowerCase()}-${level}`;
        
        // 1. Check if we need to make space
        manageCacheSize();

        // 2. Save new data with timestamp
        const cacheEntry = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) {
        console.error("Failed to save level to cache. Storage might be full.", e);
        // Emergency clear if quota is totally hit
        clearAllLevels();
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
        
        if (!stored) return null;

        const entry = JSON.parse(stored);
        
        // Update timestamp to mark as recently used (LRU)
        entry.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(entry));

        return entry.data;
    } catch (e) {
        console.error("Failed to retrieve level from cache.", e);
        return null;
    }
}

/**
 * Manages cache size by removing the least recently used items.
 */
function manageCacheSize() {
    try {
        const keys = [];
        // 1. Collect all level cache keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                keys.push(key);
            }
        }

        // 2. If we are over the limit, find the oldest
        if (keys.length >= MAX_CACHE_SIZE) {
            const entries = keys.map(key => {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: item.timestamp || 0 };
                } catch (e) {
                    return { key, timestamp: 0 };
                }
            });

            // Sort by timestamp ascending (oldest first)
            entries.sort((a, b) => a.timestamp - b.timestamp);

            // Remove the oldest items until we have space (leave room for 1 new one)
            const itemsToRemove = entries.slice(0, (keys.length - MAX_CACHE_SIZE) + 1);
            
            itemsToRemove.forEach(item => {
                localStorage.removeItem(item.key);
            });
        }
    } catch (e) {
        console.warn("Error managing cache size", e);
    }
}

/**
 * Clears all cached level data from localStorage.
 */
export function clearAllLevels() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('All cached levels cleared.');
    } catch (e) {
        console.error("Failed to clear level cache.", e);
    }
}
