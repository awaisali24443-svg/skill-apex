
import { LOCAL_STORAGE_KEYS } from '../constants.js';
import * as apiService from './apiService.js';
import * as firebaseService from './firebaseService.js';

const CACHE_PREFIX = 'kt-level-cache-';
const MAX_CACHE_SIZE = 20; // Limit to 20 levels to prevent localStorage quota errors

/**
 * Orchestrates fetching level data: Local -> Cloud -> AI.
 * This maximizes performance and minimizes cost.
 */
export async function fetchLevelData(topic, level) {
    if (!topic || !level) return null;

    // 1. Check Local Device Cache (Fastest, Free)
    const localData = getLevel(topic, level);
    if (localData) {
        console.log("Serving Level from Local Cache");
        return localData;
    }

    // 2. Check Global Cloud Cache (Fast, Cheap)
    try {
        const cloudData = await firebaseService.getGlobalLevelData(topic, level);
        if (cloudData) {
            console.log("Serving Level from Cloud Cache");
            // Cache it locally so next time it's instant
            saveLevel(topic, level, cloudData);
            return cloudData;
        }
    } catch (e) {
        console.warn("Cloud cache check failed, proceeding to AI", e);
    }

    // 3. Fallback to AI Generation (Slow, Costs Money)
    console.log("Generating Level via AI Neural Core...");
    try {
        const apiData = await apiService.generateLevelQuestions({ topic, level });
        
        if (apiData && apiData.questions) {
            // Save to Cloud for future users (Community Caching)
            firebaseService.saveGlobalLevelData(topic, level, apiData);
            // Save to Local
            saveLevel(topic, level, apiData);
        }
        return apiData;
    } catch (e) {
        console.error("AI Generation failed", e);
        return null;
    }
}

/**
 * Saves generated level data to localStorage with LRU eviction policy.
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
        clearAllLevels();
    }
}

/**
 * Retrieves cached level data from localStorage.
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
        return null;
    }
}

/**
 * Manages cache size by removing the least recently used items.
 */
function manageCacheSize() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                keys.push(key);
            }
        }

        if (keys.length >= MAX_CACHE_SIZE) {
            const entries = keys.map(key => {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: item.timestamp || 0 };
                } catch (e) {
                    return { key, timestamp: 0 };
                }
            });

            entries.sort((a, b) => a.timestamp - b.timestamp);

            const itemsToRemove = entries.slice(0, (keys.length - MAX_CACHE_SIZE) + 1);
            itemsToRemove.forEach(item => localStorage.removeItem(item.key));
        }
    } catch (e) {
        console.warn("Error managing cache size", e);
    }
}

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
    } catch (e) {
        console.error("Failed to clear level cache.", e);
    }
}
