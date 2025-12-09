
import { showToast } from './toastService.js';
import * as configService from './configService.js';

async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred.', details: response.statusText }));
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'API request failed');
    }
    return response.json();
}

async function fetchWithTimeout(url, options = {}, timeout = 60000) { // Increased to 60s
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    if (options.signal) {
        options.signal.addEventListener('abort', () => {
            clearTimeout(id);
            controller.abort();
        });
    }

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
             if (options.signal && options.signal.aborted) throw error;
             throw new Error("Request timed out. The AI is taking too long.");
        }
        throw error;
    }
}

function getPersona() {
    return configService.getConfig().aiPersona || 'apex';
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
    const response = await fetchWithTimeout('/api/generate-journey-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateJourneyFromImage(imageBase64, mimeType) {
    const response = await fetchWithTimeout('/api/generate-journey-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, persona: getPersona() })
    }, 60000); 
    return await handleResponse(response);
}

export async function generateCurriculumOutline({ topic, totalLevels }) {
    const response = await fetchWithTimeout('/api/generate-curriculum-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, totalLevels, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateLevelQuestions({ topic, level, totalLevels }) {
    const response = await fetchWithTimeout('/api/generate-level-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, totalLevels, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateInteractiveLevel({ topic, level }) {
    const response = await fetchWithTimeout('/api/generate-interactive-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateLevelLesson({ topic, level, totalLevels, questions, signal }) {
    const response = await fetchWithTimeout('/api/generate-level-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, totalLevels, questions: questions || null, persona: getPersona() }),
        signal: signal
    });
    return await handleResponse(response);
}

export async function generateBossBattle({ topic, chapter }) {
    const response = await fetchWithTimeout('/api/generate-boss-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, chapter, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateHint({ topic, question, options }) {
    const response = await fetchWithTimeout('/api/generate-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, question, options, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function generateSpeech(text) {
    const response = await fetchWithTimeout('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    return await handleResponse(response);
}

export async function explainConcept(topic, concept, context) {
    const response = await fetchWithTimeout('/api/explain-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, concept, context, persona: getPersona() })
    });
    return await handleResponse(response);
}

export async function fetchDailyChallenge() {
    const response = await fetchWithTimeout('/api/daily-challenge');
    return await handleResponse(response);
}

export async function explainError(topic, question, userChoice, correctChoice) {
    const response = await fetchWithTimeout('/api/explain-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, question, userChoice, correctChoice, persona: getPersona() })
    });
    return await handleResponse(response);
}
