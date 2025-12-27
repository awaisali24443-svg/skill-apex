
import { showToast } from './toastService.js';
import * as configService from './configService.js';

const API_BASE_URL = '/api'; 

async function postToServer(endpoint, body, retryCount = 2) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            if (retryCount > 0) return postToServer(endpoint, body, retryCount - 1);
            throw new Error(`Server status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Neural Link Error [${endpoint}]:`, error);
        return null;
    }
}

export async function fetchTopics() {
    return [
        { name: "Advanced Cloud Architecture", description: "Mastering distributed systems.", styleClass: "topic-robotics" },
        { name: "Neural Engineering", description: "From transformers to AGI.", styleClass: "topic-programming" },
        { name: "Cybersecurity Protocol", description: "Zero trust and red teaming.", styleClass: "topic-biology" }
    ];
}

export async function generateJourneyPlan(topic) {
    return await postToServer('/generate-journey-plan', { topic }) || { topicName: topic, totalLevels: 10, description: "Manual mode." };
}

export async function generateCurriculumOutline(payload) {
    return await postToServer('/generate-curriculum-outline', payload);
}

export async function generateLevelQuestions(payload) {
    return await postToServer('/generate-level-questions', payload);
}

export async function explainError(topic, question, userSelection, correctOption) {
    return await postToServer('/explain-error', { topic, question, userSelection, correctOption });
}

export async function processInterviewStep(history, topic) {
    return await postToServer('/interview-step', { history, topic });
}

export async function checkSystemStatus() {
    const start = Date.now();
    try {
        const res = await fetch(`${API_BASE_URL}/debug-status`, { method: 'POST' });
        return { status: res.ok ? 'online' : 'offline', latency: Date.now() - start };
    } catch (e) { return { status: 'error', latency: 0 }; }
}

export async function getAIClient() {
    const { GoogleGenAI } = await import("@google/genai");
    return new GoogleGenAI({ apiKey: 'PROXY' });
}
