// services/topicService.js

let curatedData = null;

async function loadCuratedData() {
    if (curatedData) {
        return curatedData;
    }
    try {
        // FIX #5: Decouple content by loading from the new API endpoint
        const response = await fetch('/api/topics');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        curatedData = await response.json();
        return curatedData;
    } catch (error) {
        console.error("Could not load curated topics data:", error);
        // Return empty structure on failure to prevent crashes
        return { categories: [], topics: {} };
    }
}

export async function getCategories() {
    const data = await loadCuratedData();
    return data.categories || [];
}

export async function getCategoryById(categoryId) {
    const data = await loadCuratedData();
    return (data.categories || []).find(cat => cat.id === categoryId);
}

export async function getTopicsForCategory(categoryId) {
    const data = await loadCuratedData();
    return data.topics[categoryId] || [];
}