

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
 * Sends a request to the backend to generate a dynamic learning journey plan.
 * @param {string} topic - The topic for the journey.
 * @returns {Promise<object>} A promise resolving to { totalLevels, description }.
 * @throws {Error} If the generation fails.
 */
export async function generateJourneyPlan(topic) {
    try {
        const response = await fetch('/api/generate-journey-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

/**
 * Sends a request to the backend to generate a curriculum outline for a journey.
 * @param {object} params - The curriculum parameters.
 * @param {string} params.topic - The topic for the journey.
 * @param {number} params.totalLevels - The total levels for the journey.
 * @returns {Promise<object>} A promise resolving to the curriculum outline.
 * @throws {Error} If the generation fails.
 */
export async function generateCurriculumOutline({ topic, totalLevels }) {
    try {
        const response = await fetch('/api/generate-curriculum-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, totalLevels })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}


/**
 * Sends a request to the backend to generate content for a specific game level.
 * @param {object} params - The level generation parameters.
 * @param {string} params.topic - The topic of the game.
 * @param {number} params.level - The level number.
 * @param {number} params.totalLevels - The total levels in the journey.
 * @returns {Promise<object>} A promise that resolves to the generated level data (lesson and questions).
 * @throws {Error} If the generation fails.
 */
export async function generateLevel({ topic, level, totalLevels }) {
    try {
        const response = await fetch('/api/generate-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level, totalLevels })
        });
        return await handleResponse(response);
    } catch (error) {
        // Errors will be handled by the calling game-level module
        throw error;
    }
}

/**
 * Sends a request to the backend to generate a cumulative "Boss Battle" for a chapter.
 * @param {object} params - The boss battle parameters.
 * @param {string} params.topic - The topic of the game.
 * @param {number} params.chapter - The chapter number.
 * @returns {Promise<object>} A promise that resolves to the generated boss battle questions.
 * @throws {Error} If the generation fails.
 */
export async function generateBossBattle({ topic, chapter }) {
    try {
        const response = await fetch('/api/generate-boss-battle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, chapter })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

/**
 * Sends a request to the backend to generate a hint for a quiz question.
 * @param {object} params - The hint parameters.
 * @param {string} params.topic - The topic of the game.
 * @param {string} params.question - The question text.
 * @param {Array<string>} params.options - The answer options.
 * @returns {Promise<object>} A promise that resolves to the generated hint data.
 * @throws {Error} If the generation fails.
 */
export async function generateHint({ topic, question, options }) {
    try {
        const response = await fetch('/api/generate-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, question, options })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

/**
 * Sends a request to the backend to generate speech from text.
 * @param {string} text - The text to synthesize.
 * @returns {Promise<object>} A promise that resolves to the object containing the audio data.
 * @throws {Error} If the generation fails.
 */
export async function generateSpeech(text) {
    try {
        const response = await fetch('/api/generate-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}