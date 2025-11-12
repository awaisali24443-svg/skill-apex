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
 * Sends a request to the backend to generate a new quiz.
 * @param {object} params - The quiz generation parameters.
 * @param {string} params.topic - The topic of the quiz.
 * @param {number} params.numQuestions - The number of questions for the quiz.
 * @param {string} params.difficulty - The difficulty level of the quiz.
 * @returns {Promise<object>} A promise that resolves to the generated quiz data.
 * @throws {Error} If the quiz generation fails.
 */
export async function generateQuiz({ topic, numQuestions, difficulty }) {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, numQuestions, difficulty })
        });
        return await handleResponse(response);
    } catch (error) {
        // The error will be handled by the loading module
        throw error;
    }
}

/**
 * Sends a request to the backend to generate a new learning path.
 * @param {object} params - The learning path generation parameters.
 * @param {string} params.goal - The learning goal.
 * @returns {Promise<object>} A promise that resolves to the generated learning path data.
 * @throws {Error} If the generation fails.
 */
export async function generateLearningPath({ goal }) {
     try {
        const response = await fetch('/api/generate-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal })
        });
        return await handleResponse(response);
    } catch (error) {
        showToast(error.message || 'Failed to generate learning path.', 'error');
        throw error;
    }
}