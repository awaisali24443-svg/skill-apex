
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
 * Helper to fetch with a timeout.
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    // If the caller provided a signal (e.g., for user cancellation), we need to respect it too.
    if (options.signal) {
        options.signal.addEventListener('abort', () => {
            clearTimeout(id);
            controller.abort();
        });
    }

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
             // If user cancelled (passed signal), treat as user abort.
             if (options.signal && options.signal.aborted) throw error;
             // Otherwise, treat as network timeout.
             throw new Error("Request timed out.");
        }
        throw error;
    }
}

export async function fetchTopics() {
    try {
        const response = await fetchWithTimeout('/api/topics');
        return await handleResponse(response);
    } catch (error) {
        showToast('Error fetching topics.', 'error');
        throw error;
    }
}

export async function generateJourneyPlan(topic) {
    try {
        const response = await fetchWithTimeout('/api/generate-journey-plan', {
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
        const response = await fetchWithTimeout('/api/generate-curriculum-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, totalLevels })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    try {
        const response = await fetchWithTimeout('/api/generate-level-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level, totalLevels })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateInteractiveLevel({ topic, level }) {
    try {
        const response = await fetchWithTimeout('/api/generate-interactive-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, level })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateLevelLesson({ topic, level, totalLevels, questions, signal }) {
    try {
        // Pass the AbortSignal to allow user cancellation, combined with timeout logic in fetchWithTimeout
        const response = await fetchWithTimeout('/api/generate-level-lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Questions are now optional for parallel generation
            body: JSON.stringify({ topic, level, totalLevels, questions: questions || null }),
            signal: signal
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateBossBattle({ topic, chapter }) {
    try {
        const response = await fetchWithTimeout('/api/generate-boss-battle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, chapter })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function generateHint({ topic, question, options }) {
    try {
        const response = await fetchWithTimeout('/api/generate-hint', {
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
        const response = await fetchWithTimeout('/api/generate-speech', {
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
        const response = await fetchWithTimeout('/api/explain-concept', {
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
        const response = await fetchWithTimeout('/api/daily-challenge');
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}

export async function explainError(topic, question, userChoice, correctChoice) {
    try {
        const response = await fetchWithTimeout('/api/explain-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, question, userChoice, correctChoice })
        });
        return await handleResponse(response);
    } catch (error) {
        throw error;
    }
}
