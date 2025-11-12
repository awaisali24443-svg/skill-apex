import { fetchTopics } from './apiService.js';

let searchIndex = [];
let isIndexReady = false;

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

export function getIndex() {
    return [...searchIndex];
}
