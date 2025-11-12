import { fetchTopics } from './apiService.js';

let searchIndex = [];
let isIndexReady = false;

/**
 * Fetches topics from the API and builds a flat, searchable index in memory.
 * This should be called once on application startup.
 */
export async function createIndex() {
    if (isIndexReady) return;

    try {
        const categories = await fetchTopics();
        searchIndex = categories.flatMap(category =>
            category.topics.map(topic => ({
                ...topic,
                category: category.category,
            }))
        );
        isIndexReady = true;
        console.log('Search index created.');
    } catch (error) {
        console.error('Failed to create search index:', error);
    }
}

/**
 * Searches the in-memory index for topics matching a query.
 * @param {string} query - The search term.
 * @returns {Array<object>} An array of topic objects that match the query.
 */
export function search(query) {
    if (!isIndexReady) {
        console.warn('Search index not ready.');
        return [];
    }
    const lowerCaseQuery = query.toLowerCase().trim();
    if (!lowerCaseQuery) {
        return [];
    }
    return searchIndex.filter(item =>
        item.name.toLowerCase().includes(lowerCaseQuery) ||
        item.category.toLowerCase().includes(lowerCaseQuery)
    );
}

/**
 * Gets a copy of the entire search index.
 * @returns {Array<object>} The complete search index.
 */
export function getIndex() {
    return [...searchIndex];
}