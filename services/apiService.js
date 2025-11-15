import { showToast } from './toastService.js';

/**
 * Handles the response from a fetch request.
 * Throws an error if the response is not ok.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<object>} The JSON response data.
 * @throws {Error} If the API response is not ok.
 * @private
 */
async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred.', details: response.statusText }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'API request failed');
    }
    return response.json();
}

/**
 * Fetches the list of quiz topics and categories.
 * @returns {Promise<Array<object>>} A promise that resolves to the topics data.
 * @throws {Error} If the fetch fails.
 */
export async function fetchTopics() {
    try {
        const response = await fetch('/api/topics');
        return await handleResponse(response);
    } catch (error) {
        showToast('Error fetching topics.', 'error');
        throw error;
    }
}

/**
 * Sends a request to the backend to generate content for a specific game level.
 * @param {object} params - The level generation parameters.
 * @param {string} params.topic - The topic of the game.
 * @param {number} params.level - The level number.
 * @returns {Promise<object>} A promise that resolves to the generated level data (lesson and questions).
 * @throws {Error} If the generation fails.
 */
export async function generateLevel({ topic, level }) {
    try {
        const response = await fetch('/api/generate-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level })
        });
        return await handleResponse(response);
    } catch (error) {
        // Errors will be handled by the calling game-level module
        throw error;
    }
}


/**
 * Sends the user's quiz history to the backend for analysis.
 * @param {Array<object>} history - The user's quiz history.
 * @returns {Promise<object>} A promise that resolves to the analysis (e.g., weak topics).
 * @throws {Error} If the analysis fails.
 */
export async function analyzePerformance(history) {
    try {
        const response = await fetch('/api/analyze-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history })
        });
        return await handleResponse(response);
    } catch (error) {
        console.error('Performance analysis failed:', error.message);
        // Silently fail, don't show a toast. Let caller handle UI.
        throw error;
    }
}