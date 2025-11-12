import { showToast } from './toastService.js';

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
