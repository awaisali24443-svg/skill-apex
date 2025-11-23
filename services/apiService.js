
import { showToast } from './toastService.js';
import * as configService from './configService.js';

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

export async function fetchTopics() {
    try {
        const response = await fetch('/api/topics');
        return await handleResponse(response);
    } catch (error) {
        showToast('Error fetching topics.', 'error');
        throw error;
    }
}

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

export async function generateLevel({ topic, level, totalLevels }) {
    const { difficulty } = configService.getConfig();
    try {
        const response = await fetch('/api/generate-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level, totalLevels, difficulty })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateBossBattle({ topic, chapter }) {
    const { difficulty } = configService.getConfig();
    try {
        const response = await fetch('/api/generate-boss-battle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, chapter, difficulty })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

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

export async function explainConcept(topic, concept, context) {
    try {
        const response = await fetch('/api/explain-concept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, concept, context })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function fetchDailyChallenge() {
    try {
        const response = await fetch('/api/daily-challenge');
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    try {
        const response = await fetch('/api/explain-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, question, userChoice, correctChoice })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}